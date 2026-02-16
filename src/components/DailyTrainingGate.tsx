import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type QuizQuestion = {
  module: string;
  id: string;       // question_id
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;
  e: string;
  correct: string; // "a" | "b" | ...
};

type Props = {
  children: React.ReactNode;
  rolesToEnforce: string[];
  videoId: string;
  videoSrc: string;
  quizXlsxPath: string;
};

function getLocalDayKeyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DailyTrainingGate({
  children,
  rolesToEnforce,
  videoId,
  videoSrc,
  quizXlsxPath,
}: Props) {
  const { user } = useAuth();

  const role = user?.role ?? "";
  const enforce = rolesToEnforce.includes(role);

  const dayKey = useMemo(() => getLocalDayKeyISO(), []);
  const [loading, setLoading] = useState(true);

  const [videoDone, setVideoDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizError, setQuizError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1) cargar estado diario
  useEffect(() => {
    let alive = true;

    async function loadDaily() {
      if (!user || !enforce) {
        if (alive) setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("training_daily")
        .select("video_completed_at, quiz_completed_at")
        .eq("user_id", user.id)
        .eq("day_key", dayKey)
        .eq("video_id", videoId)
        .maybeSingle();

      if (error) {
        console.error("training_daily select error:", error);
        if (alive) {
          setVideoDone(false);
          setQuizDone(false);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setVideoDone(!!data?.video_completed_at);
        setQuizDone(!!data?.quiz_completed_at);
        setLoading(false);
      }
    }

    loadDaily();
    return () => {
      alive = false;
    };
  }, [user, enforce, dayKey, videoId]);

  // 2) cargar quiz XLSX
  useEffect(() => {
    let alive = true;

    async function loadQuiz() {
      if (!user || !enforce) return;
      if (!videoDone || quizDone) return;

      setQuizError(null);

      try {
        const res = await fetch(quizXlsxPath, { cache: "no-store" });
        if (!res.ok) throw new Error(`No pude leer ${quizXlsxPath} (HTTP ${res.status})`);
        const ab = await res.arrayBuffer();

        const wb = XLSX.read(ab, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        const parsed: QuizQuestion[] = json
          .map((r) => ({
            module: String(r.module ?? "").trim(),
            id: String(r.id ?? "").trim(),
            question: String(r.question ?? "").trim(),
            a: String(r.a ?? "").trim(),
            b: String(r.b ?? "").trim(),
            c: String(r.c ?? "").trim(),
            d: String(r.d ?? "").trim(),
            e: String(r.e ?? "").trim(),
            correct: String(r.correct ?? "").trim().toLowerCase(),
          }))
          .filter((q) => q.id && q.question && q.correct);

        if (!parsed.length) throw new Error("El XLSX no trajo preguntas válidas.");

        if (alive) setQuestions(parsed);
      } catch (e: any) {
        console.error(e);
        if (alive) setQuizError(e?.message ?? "Error cargando el quiz.");
      }
    }

    loadQuiz();
    return () => {
      alive = false;
    };
  }, [user, enforce, videoDone, quizDone, quizXlsxPath]);

  async function markVideoDone() {
    if (!user) return;

    const { error } = await supabase.from("training_daily").upsert(
      {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,
        video_completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day_key,video_id" }
    );

    if (error) {
      console.error("video upsert error:", error);
      return;
    }

    setVideoDone(true);
  }

  async function submitQuiz() {
    if (!user) return;
    setSubmitMsg(null);

    // validar respondidas
    for (const q of questions) {
      if (!answers[q.id]) {
        setSubmitMsg("Respondé todas las preguntas para poder continuar.");
        return;
      }
    }

    // calcular resultados por pregunta + score
    const perQuestion = questions.map((q) => {
      const chosen = (answers[q.id] ?? "").toLowerCase();
      const correct = (q.correct ?? "").toLowerCase();
      const isCorrect = chosen === correct;

      return {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,

        question_id: q.id,
        module: q.module,
        question: q.question,

        chosen,
        correct,
        is_correct: isCorrect,

        chosen_text: (q as any)[chosen] ?? "",
        correct_text: (q as any)[correct] ?? "",
      };
    });

    const total = perQuestion.length;
    const correctCount = perQuestion.filter((x) => x.is_correct).length;
    const scorePct = Math.round((correctCount / total) * 100);

    // 1) upsert 10 filas (1 por pregunta)
    // onConflict requiere índice único (user_id, day_key, video_id, question_id)
    const { error: pqErr } = await supabase
      .from("training_quiz_answers")
      .upsert(perQuestion, {
        onConflict: "user_id,day_key,video_id,question_id",
      });

    if (pqErr) {
      console.error("training_quiz_answers upsert error:", pqErr);
      setSubmitMsg("No pude guardar el detalle por pregunta. Revisá RLS / permisos.");
      return;
    }

    // 2) (opcional) guardar resumen diario (para tener timestamps + score)
    const { error: dailyErr } = await supabase.from("training_daily").upsert(
      {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,
        quiz_completed_at: new Date().toISOString(),
        quiz_score: scorePct,
        quiz_answers: {
          total,
          correctCount,
          scorePct,
        },
      },
      { onConflict: "user_id,day_key,video_id" }
    );

    if (dailyErr) {
      console.error("training_daily upsert error:", dailyErr);
      setSubmitMsg("Guardé las preguntas, pero falló el resumen diario. Revisá RLS / permisos.");
      return;
    }

    setSubmitMsg(`Resultado: ${scorePct}% (${correctCount}/${total}). Continuando…`);
    setQuizDone(true);
  }

  // si no aplica, render normal
  if (!enforce) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-700">Cargando…</div>
      </div>
    );
  }

  // VIDEO
  if (!videoDone) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="max-w-3xl w-full mx-auto p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Capacitación obligatoria</h1>
          <p className="mt-2 text-gray-600">Para iniciar tu jornada, mirá el video completo.</p>

          <div className="mt-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              className="w-full h-auto bg-black"
              onEnded={markVideoDone}
            />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Cuando finalice el video, vas a pasar automáticamente al quiz.
          </p>
        </div>
      </div>
    );
  }

  // QUIZ
  if (!quizDone) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Quiz obligatorio</h1>
          <p className="mt-2 text-gray-600">Completá el quiz para poder continuar.</p>

          {quizError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
              {quizError}
            </div>
          )}

          {!quizError && questions.length === 0 && (
            <div className="mt-6 text-gray-700">Cargando preguntas…</div>
          )}

          {!quizError && questions.length > 0 && (
            <div className="mt-6 space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl border border-gray-200">
                  <div className="font-medium text-gray-900">
                    {idx + 1}. {q.question}
                  </div>

                  <div className="mt-3 space-y-2">
                    {(["a", "b", "c", "d", "e"] as const).map((opt) => {
                      const label = (q as any)[opt] as string;
                      if (!label) return null;

                      return (
                        <label key={opt} className="flex gap-3 items-start cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={(answers[q.id] ?? "") === opt}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            className="mt-1"
                          />
                          <span className="text-gray-800">
                            <span className="font-semibold mr-2">{opt.toUpperCase()}.</span>
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {submitMsg && (
                <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
                  {submitMsg}
                </div>
              )}

              <button
                onClick={submitQuiz}
                className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                Enviar respuestas
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // listo
  return <>{children}</>;
}

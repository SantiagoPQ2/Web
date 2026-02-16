import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type QuizQuestion = {
  module: string;
  id: string;
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

  // Roles que deben completar video+quiz para entrar
  rolesToEnforce: string[];

  // Identificador del video (versionable)
  videoId: string;

  // URL pública del mp4
  videoSrc: string;

  // Path al XLSX dentro de /public (ej: "/Quiz.xlsx")
  quizXlsxPath: string;
};

// YYYY-MM-DD (local)
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

  // 1) cargar estado diario desde supabase
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
        // si falla, igual bloqueamos (no dejamos "saltear")
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

  // 2) cargar quiz desde /public/Quiz.xlsx cuando corresponde
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

        // Espera columnas: module,id,question,a,b,c,d,e,correct
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

    const payload = {
      user_id: user.id,
      day_key: dayKey,
      video_id: videoId,
      video_completed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("training_daily")
      .upsert(payload, { onConflict: "user_id,day_key,video_id" });

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

    // armar detalle por pregunta (bien/mal)
    const perQuestion = questions.map((q) => {
      const chosen = (answers[q.id] ?? "").toLowerCase();
      const correct = (q.correct ?? "").toLowerCase();
      const isCorrect = chosen === correct;

      return {
        id: q.id,
        module: q.module,
        question: q.question,
        chosen, // "a"|"b"|...
        correct,
        isCorrect,
        chosenText: (q as any)[chosen] ?? "",
        correctText: (q as any)[correct] ?? "",
      };
    });

    const total = questions.length;
    const correctCount = perQuestion.filter((x) => x.isCorrect).length;
    const scorePct = Math.round((correctCount / total) * 100);

    const answersPayload = {
      video_id: videoId,
      day_key: dayKey,
      scorePct,
      correctCount,
      total,
      answers, // { [questionId]: "a"|"b"|... }
      perQuestion,
    };

    // 1) guardar intento (auditoría)
    const insAttempt = await supabase.from("training_quiz_attempts").insert({
      user_id: user.id,
      day_key: dayKey,
      video_id: videoId,
      score: scorePct,
      passed: true, // ya no hay "aprobación": siempre true para no romper schema
      answers: answersPayload,
      per_question: perQuestion,
    });

    if (insAttempt.error) {
      console.error("quiz attempt insert error:", insAttempt.error);
      // No bloqueamos por esto
    }

    // 2) marcar daily como completado SIEMPRE
    const up = await supabase.from("training_daily").upsert(
      {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,
        quiz_completed_at: new Date().toISOString(),
        quiz_score: scorePct,
        quiz_answers: answersPayload,
        quiz_per_question: perQuestion,
      },
      { onConflict: "user_id,day_key,video_id" }
    );

    if (up.error) {
      console.error("quiz daily upsert error:", up.error);
      setSubmitMsg("Guardado falló en servidor. Revisá RLS / permisos.");
      return;
    }

    setSubmitMsg(`Resultado: ${scorePct}% (${correctCount}/${total}). Continuando…`);
    setQuizDone(true);
  }

  // si no aplica, render normal
  if (!enforce) return <>{children}</>;

  // mientras carga estado
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-700">Cargando…</div>
      </div>
    );
  }

  // GATE: VIDEO
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

  // GATE: QUIZ
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

  // si completó todo, app normal
  return <>{children}</>;
}

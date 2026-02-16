import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type QuizQuestion = {
  module: string;
  id: string; // question_id
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
  passingScorePct?: number; // default 90
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
  passingScorePct = 90,
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
  const [lockedCorrectIds, setLockedCorrectIds] = useState<Set<string>>(new Set());
  const [incorrectIds, setIncorrectIds] = useState<Set<string>>(new Set());

  const [quizError, setQuizError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const [showVideoInQuiz, setShowVideoInQuiz] = useState(false);

  // ✅ clave: para que SOLO se guarde 1 vez
  const [firstAttemptAlreadySaved, setFirstAttemptAlreadySaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // cargar estado
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
        .select("video_completed_at, quiz_completed_at, quiz_first_attempt_at")
        .eq("user_id", user.id)
        .eq("day_key", dayKey)
        .eq("video_id", videoId)
        .maybeSingle();

      if (error) {
        console.error("training_daily select error:", error);
        if (alive) {
          setVideoDone(false);
          setQuizDone(false);
          setFirstAttemptAlreadySaved(false);
          setLoading(false);
        }
        return;
      }

      if (!alive) return;

      setVideoDone(!!data?.video_completed_at);
      setQuizDone(!!data?.quiz_completed_at);
      setFirstAttemptAlreadySaved(!!data?.quiz_first_attempt_at);
      setLoading(false);
    }

    loadDaily();
    return () => {
      alive = false;
    };
  }, [user, enforce, dayKey, videoId]);

  // cargar quiz xlsx
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

  function computeResult() {
    const perQuestion = questions.map((q) => {
      const chosen = (answers[q.id] ?? "").toLowerCase();
      const correct = (q.correct ?? "").toLowerCase();
      const isCorrect = chosen === correct;

      return {
        id: q.id,
        module: q.module,
        question: q.question,
        chosen,
        correct,
        isCorrect,
        chosenText: (q as any)[chosen] ?? "",
        correctText: (q as any)[correct] ?? "",
      };
    });

    const total = perQuestion.length;
    const correctCount = perQuestion.filter((x) => x.isCorrect).length;
    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return { perQuestion, total, correctCount, scorePct };
  }

  // ✅ guarda SOLO primer intento: 10 filas + snapshot training_daily
  async function saveFirstAttemptIfNeeded(payload: {
    perQuestion: ReturnType<typeof computeResult>["perQuestion"];
    total: number;
    correctCount: number;
    scorePct: number;
    answersSnapshot: Record<string, string>;
  }) {
    if (!user) return;

    if (firstAttemptAlreadySaved) return;

    // 1) Insertar 10 filas en training_quiz_answers (primer intento)
    const rows = payload.perQuestion.map((x) => ({
      user_id: user.id,
      day_key: dayKey,
      video_id: videoId,
      question_id: x.id,
      module: x.module,
      question: x.question,
      chosen: x.chosen,
      correct: x.correct,
      is_correct: x.isCorrect,
      chosen_text: x.chosenText,
      correct_text: x.correctText,
    }));

    // Usamos upsert pero SOLO se llama 1 vez, así que no se sobreescribe por reintentos.
    const { error: pqErr } = await supabase.from("training_quiz_answers").upsert(rows, {
      onConflict: "user_id,day_key,video_id,question_id",
    });

    if (pqErr) {
      console.error("training_quiz_answers upsert error:", pqErr);
      throw new Error("No pude guardar las respuestas del primer intento (tabla training_quiz_answers).");
    }

    // 2) Guardar snapshot del primer intento en training_daily
    const firstAttemptSnapshot = {
      video_id: videoId,
      day_key: dayKey,
      total: payload.total,
      correctCount: payload.correctCount,
      scorePct: payload.scorePct,
      answers: payload.answersSnapshot,
      perQuestion: payload.perQuestion.map((x) => ({
        id: x.id,
        module: x.module,
        question: x.question,
        chosen: x.chosen,
        correct: x.correct,
        isCorrect: x.isCorrect,
        chosenText: x.chosenText,
        correctText: x.correctText,
      })),
    };

    const { error: dailyErr } = await supabase.from("training_daily").upsert(
      {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,
        quiz_first_attempt_at: new Date().toISOString(),
        quiz_first_attempt_score: payload.scorePct,
        quiz_first_attempt_answers: firstAttemptSnapshot,
      },
      { onConflict: "user_id,day_key,video_id" }
    );

    if (dailyErr) {
      console.error("training_daily first attempt upsert error:", dailyErr);
      throw new Error("No pude guardar el primer intento (training_daily).");
    }

    setFirstAttemptAlreadySaved(true);
  }

  async function markQuizCompleted(finalScorePct: number) {
    if (!user) return;

    const { error } = await supabase.from("training_daily").upsert(
      {
        user_id: user.id,
        day_key: dayKey,
        video_id: videoId,
        quiz_completed_at: new Date().toISOString(),
        quiz_score: finalScorePct,
      },
      { onConflict: "user_id,day_key,video_id" }
    );

    if (error) {
      console.error("mark quiz completed error:", error);
      throw new Error("No pude marcar el quiz como completado.");
    }
  }

  async function submitQuiz() {
    if (!user) return;
    setSubmitMsg(null);

    // validar respondidas (excepto las lockeadas)
    for (const q of questions) {
      if (lockedCorrectIds.has(q.id)) continue;
      if (!answers[q.id]) {
        setSubmitMsg("Respondé todas las preguntas para poder continuar.");
        return;
      }
    }

    const { perQuestion, total, correctCount, scorePct } = computeResult();

    // actualizar UI: lock correctas, marcar incorrectas
    const newlyCorrect = new Set(lockedCorrectIds);
    const newlyIncorrect = new Set<string>();

    for (const row of perQuestion) {
      if (row.isCorrect) newlyCorrect.add(row.id);
      else newlyIncorrect.add(row.id);
    }

    setLockedCorrectIds(newlyCorrect);
    setIncorrectIds(newlyIncorrect);

    try {
      // ✅ Guardar SOLO el primer submit
      await saveFirstAttemptIfNeeded({
        perQuestion,
        total,
        correctCount,
        scorePct,
        answersSnapshot: { ...answers },
      });

      if (scorePct >= passingScorePct) {
        await markQuizCompleted(scorePct);
        setSubmitMsg(`Resultado: ${scorePct}% (${correctCount}/${total}). ✅ Aprobado.`);
        setQuizDone(true);
      } else {
        setSubmitMsg(
          `Resultado: ${scorePct}% (${correctCount}/${total}). Necesitás ${passingScorePct}% para continuar.`
        );
      }
    } catch (e: any) {
      setSubmitMsg(e?.message ?? "Error guardando en servidor.");
    }
  }

  if (!enforce) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-700">Cargando…</div>
      </div>
    );
  }

  // VIDEO gate
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

  // QUIZ gate
  if (!quizDone) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Quiz obligatorio</h1>
          <p className="mt-2 text-gray-600">
            Tenés que alcanzar <b>{passingScorePct}%</b> para continuar.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowVideoInQuiz((v) => !v)}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {showVideoInQuiz ? "Ocultar video" : "Volver a ver el video"}
            </button>

            {firstAttemptAlreadySaved && (
              <span className="text-sm text-gray-500">(El primer intento ya quedó registrado)</span>
            )}
          </div>

          {showVideoInQuiz && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <video src={videoSrc} controls playsInline className="w-full h-auto bg-black" />
            </div>
          )}

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
              {questions.map((q, idx) => {
                const isLockedCorrect = lockedCorrectIds.has(q.id);
                const isIncorrect = incorrectIds.has(q.id);

                return (
                  <div
                    key={q.id}
                    className={[
                      "p-4 rounded-xl border",
                      isLockedCorrect
                        ? "border-green-300 bg-green-50"
                        : isIncorrect
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-200",
                    ].join(" ")}
                  >
                    <div className="font-medium text-gray-900 flex items-start justify-between gap-3">
                      <span>
                        {idx + 1}. {q.question}
                      </span>

                      {isLockedCorrect && (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                          Correcta
                        </span>
                      )}

                      {isIncorrect && !isLockedCorrect && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                          Incorrecta
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {(["a", "b", "c", "d", "e"] as const).map((opt) => {
                        const label = (q as any)[opt] as string;
                        if (!label) return null;

                        const disabled = isLockedCorrect;
                        const checked = (answers[q.id] ?? "") === opt;

                        return (
                          <label
                            key={opt}
                            className={`flex gap-3 items-start cursor-pointer ${
                              disabled ? "opacity-70 cursor-not-allowed" : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              disabled={disabled}
                              checked={checked}
                              onChange={() => {
                                if (disabled) return;
                                setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                              }}
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

                    {isIncorrect && !isLockedCorrect && (
                      <div className="mt-3 text-sm text-amber-800">
                        Esta respuesta está incorrecta. Volvé a intentarlo.
                      </div>
                    )}
                  </div>
                );
              })}

              {submitMsg && (
                <div className="p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200">
                  {submitMsg}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={submitQuiz}
                  className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Enviar respuestas
                </button>

                <span className="text-sm text-gray-500">
                  Podés reintentar. Las correctas quedarán bloqueadas.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

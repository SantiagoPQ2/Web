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

  // Para garantizar “guardar solo primer intento”
  const [firstAttemptAlreadySaved, setFirstAttemptAlreadySaved] = useState(false);

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

    const { error } = await supabase
      .from("training_daily")
      .upsert(
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
        // NO mostramos correctText al usuario, pero lo podemos guardar en 1er intento si querés:
        correctText: (q as any)[correct] ?? "",
      };
    });

    const total = perQuestion.length;
    const correctCount = perQuestion.filter((x) => x.isCorrect).length;
    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return { perQuestion, total, correctCount, scorePct };
  }

  async function saveFirstAttemptIfNeeded(firstAttemptPayload: any, scorePct: number) {
    if (!user) return;

    // Si ya se guardó, no hacemos nada
    if (firstAttemptAlreadySaved) return;

    // Guardar SOLO el primer intento en training_daily
    const { error } = await supabase
      .from("training_daily")
      .upsert(
        {
          user_id: user.id,
          day_key: dayKey,
          video_id: videoId,
          quiz_first_attempt_at: new Date().toISOString(),
          quiz_first_attempt_score: scorePct,
          quiz_first_attempt_answers: firstAttemptPayload,
        },
        { onConflict: "user_id,day_key,video_id" }
      );

    if (error) {
      console.error("save first attempt error:", error);
      // Si falla, igual no dejamos pasar, porque querés registro del 1er intento
      throw new Error("No pude guardar el primer intento. Revisá RLS / permisos.");
    }

    setFirstAttemptAlreadySaved(true);
  }

  async function markQuizCompleted(finalScorePct: number) {
    if (!user) return;

    const { error } = await supabase
      .from("training_daily")
      .upsert(
        {
          user_id: user.id,
          day_key: dayKey,
          video_id: videoId,
          quiz_completed_at: new Date().toISOString(),
          quiz_score: finalScorePct, // score final
        },
        { onConflict: "user_id,day_key,video_id" }
      );

    if (error) {
      console.error("mark quiz completed error:", error);
      throw new Error("No pude marcar el quiz como completado. Revisá RLS / permisos.");
    }
  }

  async function submitQuiz() {
    if (!user) return;
    setSubmitMsg(null);

    // validar respondidas
    for (const q of questions) {
      // si está lockeada como correcta, ya está respondida
      if (lockedCorrectIds.has(q.id)) continue;

      if (!answers[q.id]) {
        setSubmitMsg("Respondé todas las preguntas para poder continuar.");
        return;
      }
    }

    const { perQuestion, total, correctCount, scorePct } = computeResult();

    // update UI sets (lock correct, mark incorrect)
    const newlyCorrect = new Set(lockedCorrectIds);
    const newlyIncorrect = new Set<string>();

    for (const row of perQuestion) {
      if (row.isCorrect) newlyCorrect.add(row.id);
      else newlyIncorrect.add(row.id);
    }

    setLockedCorrectIds(newlyCorrect);
    setIncorrectIds(newlyIncorrect);

    // preparar payload del PRIMER intento (solo 1 vez)
    const firstAttemptPayload = {
      video_id: videoId,
      day_key: dayKey,
      total,
      correctCount,
      scorePct,
      // Guardamos detalle por pregunta (incluye correct para auditoría interna)
      perQuestion: perQuestion.map((x) => ({
        id: x.id,
        module: x.module,
        question: x.question,
        chosen: x.chosen,
        correct: x.correct,
        isCorrect: x.isCorrect,
        chosenText: x.chosenText,
        correctText: x.correctText,
      })),
      answers, // snapshot del primer submit
    };

    try {
      // ✅ Solo primer intento se guarda
      await saveFirstAttemptIfNeeded(firstAttemptPayload, scorePct);

      // Gate por 90%
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

  // si no aplica, render normal
  if (!enforce) return <>{children}</>;

  // loading
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
          <p className="mt-2 text-gray-600">
            Tenés que alcanzar <b>{passingScorePct}%</b> para continuar.
          </p>

          {/* Botón para re-ver video */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowVideoInQuiz((v) => !v)}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {showVideoInQuiz ? "Ocultar video" : "Volver a ver el video"}
            </button>

            {firstAttemptAlreadySaved && (
              <span className="text-sm text-gray-500">
                (El primer intento ya quedó registrado)
              </span>
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

                        const disabled = isLockedCorrect; // si está correcta, bloqueamos cambios
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

                    {/* Nota: NO mostramos la correcta */}
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

  // si completó todo, app normal
  return <>{children}</>;
}

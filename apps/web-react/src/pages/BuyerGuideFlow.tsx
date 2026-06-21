import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input, toast } from '@blinkdotnew/ui';
import { ArrowLeft, ArrowRight, Loader2, LogIn, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  BuyerGuideListingMatch,
  BuyerGuideRecommendations,
  BuyerPurchaseGuideRecord,
  getBuyerGuideRecommendations,
  getBuyerGuideSession,
  respondToBuyerGuide,
  selectBuyerGuideListing,
  startBuyerGuideDiscovery,
  updateBuyerGuideSession,
} from '@/lib/api';
import { BUYER_GUIDE_DISCLAIMER, BUYER_GUIDE_STEPS } from '@/data/buyer-guide-steps';
import {
  BuyerGuideBudgetSlider,
  BuyerGuideListingMatches,
  BuyerGuideOptionChips,
  BuyerGuideProgress,
  BuyerGuideQuestionCard,
  BuyerGuideRecommendationSummary,
  BuyerGuideResumeBanner,
  BuyerGuideSafetyChecklist,
  BuyerGuideVehiclePreferenceCards,
} from '@/components/buyer-guide/BuyerGuideComponents';

const LOCAL_SESSION_KEY = 'kerodex-buyer-guide-session';
const LOCAL_STATE_KEY = 'kerodex-buyer-guide-local-state';

type Question = {
  id: string;
  title: string;
  description?: string;
  type: 'single' | 'multi' | 'budget' | 'text' | 'vehicle';
  options?: { value: string; label: string; description?: string }[];
  min?: number;
  max?: number;
  defaultValue?: any;
};

const QUESTIONS: Question[] = [
  {
    id: 'purpose',
    title: 'What are you mainly buying this vehicle for?',
    type: 'single',
    options: [
      { value: 'commuting', label: 'Daily commuting', description: 'Reliability and running costs matter most.' },
      { value: 'family', label: 'Family driving', description: 'Passenger space, comfort, and safety.' },
      { value: 'work', label: 'Work or hauling', description: 'Cargo, towing, or utility needs.' },
      { value: 'first_car', label: 'First vehicle', description: 'Straightforward ownership and manageable costs.' },
      { value: 'weekend', label: 'Weekend or lifestyle', description: 'Style, performance, or adventure.' },
      { value: 'mixed', label: 'A little of everything', description: 'A balanced all-purpose vehicle.' },
    ],
  },
  { id: 'idealBudget', title: 'What is your ideal budget?', description: 'Aim for a comfortable purchase price before taxes, registration, insurance, or repairs.', type: 'budget', min: 3000, max: 80000, defaultValue: 18000 },
  { id: 'maxPrice', title: 'What is the highest price you would seriously consider?', description: 'We will use this as a ceiling, not a target.', type: 'budget', min: 5000, max: 100000, defaultValue: 24000 },
  {
    id: 'passengers',
    title: 'How many people do you usually drive with?',
    type: 'single',
    options: [
      { value: '1', label: 'Mostly just me' },
      { value: '2', label: 'Two people' },
      { value: '4', label: 'Three to five' },
      { value: '6', label: 'Six or more' },
    ],
  },
  {
    id: 'priorities',
    title: 'What matters most to you?',
    description: 'Choose up to four. There is no perfect vehicle, so this helps us understand your tradeoffs.',
    type: 'multi',
    options: ['Reliability', 'Fuel economy', 'Space', 'Performance', 'Comfort', 'Low maintenance', 'Safety', 'Style'].map((label) => ({ value: label.toLowerCase(), label })),
  },
  { id: 'bodyTypes', title: 'Which vehicle shapes feel closest to what you want?', description: 'Choose more than one, or stay open.', type: 'vehicle', defaultValue: [] },
  {
    id: 'agePreference',
    title: 'How do you feel about vehicle age?',
    type: 'single',
    options: [
      { value: 'newer', label: 'Prefer newer', description: 'I can spend more for newer features and fewer years of wear.' },
      { value: 'balanced', label: 'Balance age and value', description: 'A sensible middle ground.' },
      { value: 'older_reliable', label: 'Older is fine if proven', description: 'Maintenance history matters more than model year.' },
    ],
  },
  {
    id: 'fuelEconomy',
    title: 'How important is fuel economy?',
    type: 'single',
    options: [
      { value: 'very_important', label: 'Very important' },
      { value: 'important', label: 'Important, but not everything' },
      { value: 'not_priority', label: 'Not a major priority' },
    ],
  },
  {
    id: 'longDistance',
    title: 'Do you expect to drive long distances often?',
    type: 'single',
    options: [
      { value: 'often', label: 'Yes, often' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'rarely', label: 'Rarely' },
    ],
  },
  {
    id: 'cargo',
    title: 'How much cargo space do you need?',
    type: 'single',
    options: [
      { value: 'important', label: 'A lot', description: 'People, equipment, pets, or frequent large loads.' },
      { value: 'some', label: 'Some flexibility', description: 'Groceries, luggage, and occasional larger items.' },
      { value: 'minimal', label: 'Very little', description: 'A normal trunk is enough.' },
    ],
  },
  { id: 'likes', title: 'Any makes or models you already like?', description: 'Optional. You can also mention vehicles you have owned before.', type: 'text' },
  { id: 'dislikes', title: 'Anything you definitely do not want?', description: 'Optional. Include brands, models, body styles, or ownership concerns.', type: 'text' },
];

function readLocalState() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function BuyerGuideFlowPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<BuyerPurchaseGuideRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>(() => readLocalState().answers || {});
  const [questionIndex, setQuestionIndex] = useState(() => Number(readLocalState().questionIndex || 0));
  const [stage, setStage] = useState<'loading' | 'welcome' | 'questions' | 'recommendations' | 'matches' | 'purchase' | 'error'>('loading');
  const [recommendations, setRecommendations] = useState<BuyerGuideRecommendations | null>(null);
  const [matches, setMatches] = useState<BuyerGuideListingMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [completedPurchaseSteps, setCompletedPurchaseSteps] = useState<string[]>([]);

  const question = QUESTIONS[questionIndex];
  const answer = question ? answers[question.id] ?? question.defaultValue ?? (question.type === 'multi' || question.type === 'vehicle' ? [] : '') : '';

  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      const localId = localStorage.getItem(LOCAL_SESSION_KEY);
      try {
        let active: BuyerPurchaseGuideRecord | null = null;
        if (localId) {
          try {
            active = await getBuyerGuideSession(localId);
          } catch {
            localStorage.removeItem(LOCAL_SESSION_KEY);
          }
        }
        if (!active) active = (await startBuyerGuideDiscovery()).session;
        if (!alive) return;
        setSession(active);
        localStorage.setItem(LOCAL_SESSION_KEY, active.id);
        const startingListingId = new URLSearchParams(window.location.search).get('listing');
        if (startingListingId) {
          const selected = await selectBuyerGuideListing(active.id, startingListingId);
          if (!alive) return;
          setSession(selected.session);
          if (user) {
            navigate({ to: '/buyer-guides/$guideId', params: { guideId: selected.guide.id } });
          } else {
            setSelectedListing(selected.guide.listing);
            setStage('purchase');
          }
          return;
        }
        const savedAnswers = active.buyerAnswers || active.buyer_answers || {};
        if (Object.keys(savedAnswers).length) setAnswers((current) => ({ ...current, ...savedAnswers }));
        const savedRecommendations = active.recommendations || null;
        const savedMatches = active.listingMatches || active.listing_matches || [];
        if (savedRecommendations) {
          setRecommendations(savedRecommendations);
          setMatches(savedMatches);
          setResumeAvailable(true);
          setStage('welcome');
        } else if (Object.keys(savedAnswers).length || questionIndex > 0) {
          setResumeAvailable(true);
          setStage('welcome');
        } else {
          setStage('welcome');
        }
      } catch (error: any) {
        if (!alive) return;
        setStage('error');
        toast.error(error?.message || 'Unable to start Buyer Guide.');
      }
    };
    initialize();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ answers, questionIndex }));
  }, [answers, questionIndex]);

  useEffect(() => {
    if (!user || !session || session.buyerId || session.buyer_id) return;
    updateBuyerGuideSession(session.id, {
      buyerAnswers: answers,
      currentStage: stage,
      currentStep: question?.id || '',
    }).then((updated) => setSession(updated)).catch(() => {});
  }, [user?.id]);

  const canContinue = useMemo(() => {
    if (!question) return false;
    if (['likes', 'dislikes'].includes(question.id)) return true;
    if (Array.isArray(answer)) return answer.length > 0;
    return answer !== '' && answer !== undefined && answer !== null;
  }, [answer, question]);

  const setAnswer = (value: any) => {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
  };

  const persistAnswer = async (nextIndex: number) => {
    if (!session || !question) return;
    const nextAnswers = { ...answers, [question.id]: answer };
    setAnswers(nextAnswers);
    try {
      const updated = await respondToBuyerGuide(session.id, {
        answerKey: question.id,
        value: answer,
        answers: nextAnswers,
        currentStage: 'understand_buyer',
        currentStep: QUESTIONS[nextIndex]?.id || 'recommendations',
      });
      setSession(updated);
    } catch (error: any) {
      toast.error(error?.message || 'Your answer could not be saved. You can keep going on this device.');
    }
  };

  const nextQuestion = async () => {
    if (!canContinue || !question) return;
    if (questionIndex < QUESTIONS.length - 1) {
      const next = questionIndex + 1;
      await persistAnswer(next);
      setQuestionIndex(next);
      return;
    }
    await persistAnswer(questionIndex);
    await generateRecommendations();
  };

  const generateRecommendations = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await getBuyerGuideRecommendations(session.id, answers);
      setSession(result.session);
      setRecommendations(result.recommendations);
      setMatches(result.matches);
      setStage('recommendations');
      if (result.fallbackUsed) toast.success('Your recommendations are ready using Kerodex fallback guidance.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to prepare recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const restart = async () => {
    if (session) {
      await updateBuyerGuideSession(session.id, { status: 'abandoned' }).catch(() => {});
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem(LOCAL_STATE_KEY);
    setAnswers({});
    setQuestionIndex(0);
    setRecommendations(null);
    setMatches([]);
    setSelectedListing(null);
    setCompletedPurchaseSteps([]);
    const result = await startBuyerGuideDiscovery();
    setSession(result.session);
    localStorage.setItem(LOCAL_SESSION_KEY, result.session.id);
    setResumeAvailable(false);
    setStage('questions');
  };

  const resume = () => {
    if (recommendations) setStage(matches.length ? 'matches' : 'recommendations');
    else setStage('questions');
    setResumeAvailable(false);
  };

  const selectListing = async (listingId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await selectBuyerGuideListing(session.id, listingId);
      const listing = matches.find((match) => match.listing.id === listingId)?.listing;
      setSession(result.session);
      if (user) {
        navigate({ to: '/buyer-guides/$guideId', params: { guideId: result.guide.id } });
      } else {
        setSelectedListing(listing);
        setStage('purchase');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to continue with this listing.');
    } finally {
      setLoading(false);
    }
  };

  const removeMatch = (listingId: string) => setMatches((current) => current.filter((match) => match.listing.id !== listingId));

  if (stage === 'loading') {
    return <div className="fixed inset-0 z-50 bg-background grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (stage === 'error') {
    return (
      <div className="fixed inset-0 z-50 bg-background grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-black">Buyer Guide is temporarily unavailable.</h1>
          <Button onClick={() => navigate({ to: '/' })} variant="outline" className="mt-5">Back to Kerodex</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate({ to: '/' })} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
            <X className="h-4 w-4" /> Exit
          </button>
          <div className="text-center">
            <div className="text-[13px] font-black tracking-tight">Buyer Guide</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Kerodex</div>
          </div>
          <button onClick={restart} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
        </div>
      </header>

      {!user && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              You can continue without an account, but your progress may not be saved if you leave or refresh. Sign in to save your Buyer Guide progress.
            </p>
            <Button onClick={login} variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider shrink-0">
              <LogIn className="h-3.5 w-3.5 mr-1.5" /> Sign in to save
            </Button>
          </div>
        </div>
      )}
      {user && (
        <div className="border-b border-border bg-muted/20">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Progress saves automatically · You can continue later from your dashboard
          </div>
        </div>
      )}

      <div className="border-b border-border bg-amber-50/60 dark:bg-amber-950/15">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 text-[11px] leading-relaxed text-amber-950 dark:text-amber-200">
          <strong>Safety reminder:</strong> verify the VIN and title, consider an independent inspection, meet in a safe public place, and avoid gift cards, cryptocurrency, or suspicious wire-transfer requests.
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {stage === 'welcome' && (
          <div className="max-w-4xl mx-auto py-8 md:py-16">
            {resumeAvailable && <BuyerGuideResumeBanner onResume={resume} onRestart={restart} />}
            <section className="mt-8 md:mt-12 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">From first question to final paperwork</p>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.98] mt-5">Buying a car is a lot. We’ll walk you through it.</h1>
              <p className="text-[15px] text-muted-foreground leading-relaxed mt-5 max-w-2xl">
                Start with what you need, compare realistic vehicle options, review Kerodex listings, then continue through inspection, payment, title transfer, insurance, and registration.
              </p>
              {!resumeAvailable && (
                <Button onClick={() => setStage('questions')} className="mt-8 h-11 px-6 text-[11px] font-bold uppercase tracking-widest">
                  Let’s narrow this down <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </section>
          </div>
        )}

        {stage === 'questions' && question && (
          <div>
            <BuyerGuideProgress current={questionIndex + 1} total={QUESTIONS.length} stageLabel="Stage 1 · Understand your needs" />
            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="py-10 md:py-16"
              >
                <BuyerGuideQuestionCard eyebrow={`Question ${questionIndex + 1} of ${QUESTIONS.length}`} title={question.title} description={question.description}>
                  {question.type === 'single' && (
                    <BuyerGuideOptionChips options={question.options || []} value={String(answer || '')} onChange={setAnswer} />
                  )}
                  {question.type === 'multi' && (
                    <BuyerGuideOptionChips options={question.options || []} value={Array.isArray(answer) ? answer : []} multiple onChange={setAnswer} />
                  )}
                  {question.type === 'budget' && (
                    <BuyerGuideBudgetSlider value={Number(answer || question.defaultValue)} min={question.min || 0} max={question.max || 100000} label={question.id === 'idealBudget' ? 'Ideal purchase price' : 'Maximum price'} onChange={setAnswer} />
                  )}
                  {question.type === 'vehicle' && (
                    <BuyerGuideVehiclePreferenceCards value={Array.isArray(answer) ? answer : []} onChange={setAnswer} />
                  )}
                  {question.type === 'text' && (
                    <Input value={String(answer || '')} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your answer, or leave this blank" className="h-12 text-[14px]" autoFocus />
                  )}
                  <div className="mt-8 flex items-center justify-between gap-4">
                    <Button
                      variant="outline"
                      disabled={questionIndex === 0}
                      onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
                      className="h-10 px-4 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back
                    </Button>
                    <Button disabled={!canContinue || loading} onClick={nextQuestion} className="h-10 px-5 text-[10px] font-bold uppercase tracking-wider">
                      {questionIndex === QUESTIONS.length - 1 ? 'See recommendations' : 'Continue'}
                      {loading ? <Loader2 className="h-3.5 w-3.5 ml-2 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5 ml-2" />}
                    </Button>
                  </div>
                </BuyerGuideQuestionCard>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {stage === 'recommendations' && recommendations && (
          <div className="space-y-8">
            <BuyerGuideProgress current={2} total={4} stageLabel="Stage 2 · Vehicle recommendations" />
            <BuyerGuideRecommendationSummary recommendations={recommendations} />
            <BuyerGuideSafetyChecklist notes={recommendations.safetyNotes} />
            <div className="flex justify-end">
              <Button onClick={() => setStage('matches')} className="h-11 px-6 text-[11px] font-bold uppercase tracking-widest">
                View matching listings <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {stage === 'matches' && recommendations && (
          <div className="space-y-8">
            <BuyerGuideProgress current={3} total={4} stageLabel="Stage 3 · Kerodex matches" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Best available matches</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mt-3">Listings worth a closer look</h1>
              <p className="text-[13px] text-muted-foreground mt-3 max-w-2xl">We show why each listing may fit and surface concerns instead of hiding them.</p>
            </div>
            <BuyerGuideListingMatches matches={matches} onSelect={selectListing} onReject={removeMatch} />
            <BuyerGuideSafetyChecklist notes={recommendations.safetyNotes} />
          </div>
        )}

        {stage === 'purchase' && selectedListing && (
          <div className="space-y-8">
            <BuyerGuideProgress current={4} total={4} stageLabel="Stage 4 · Evaluate and purchase safely" />
            <div className="border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected vehicle</p>
                {(selectedListing.isDemo || selectedListing.is_demo) && (
                  <span className="border border-foreground px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">Demo Listing</span>
                )}
              </div>
              <h1 className="text-2xl md:text-4xl font-black mt-2">{selectedListing.year} {selectedListing.make} {selectedListing.model}</h1>
              <p className="text-[13px] text-muted-foreground mt-2">${Number(selectedListing.price || 0).toLocaleString()} · {selectedListing.location}</p>
              {(selectedListing.isDemo || selectedListing.is_demo) && (
                <p className="mt-3 text-[11px] text-muted-foreground">This is a sample listing and is not available for purchase.</p>
              )}
            </div>
            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              <aside className="border border-border">
                {BUYER_GUIDE_STEPS.map((step, index) => {
                  const done = completedPurchaseSteps.includes(step.id);
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCompletedPurchaseSteps((current) => done ? current.filter((id) => id !== step.id) : [...current, step.id])}
                      className="w-full border-b border-border last:border-b-0 p-4 text-left flex gap-3 hover:bg-muted/20"
                    >
                      <span className={`h-5 w-5 border flex items-center justify-center shrink-0 ${done ? 'bg-foreground text-background border-foreground' : 'border-border'}`}>
                        {done && <ShieldCheck className="h-3 w-3" />}
                      </span>
                      <span><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Step {index + 1}</span><span className="text-[12px] font-bold">{step.title}</span></span>
                    </button>
                  );
                })}
              </aside>
              <section className="border border-border p-5 md:p-7">
                <h2 className="text-2xl font-black">Your ownership checklist</h2>
                <p className="text-[13px] text-muted-foreground mt-2">Work through the steps at your own pace. Sign in to attach this checklist permanently to your account.</p>
                <div className="mt-7 space-y-5">
                  {BUYER_GUIDE_STEPS.map((step) => (
                    <article key={step.id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                      <h3 className="text-[14px] font-bold">{step.title}</h3>
                      <p className="text-[12px] text-muted-foreground mt-1">{step.short}</p>
                      {step.warning && <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">{step.warning}</p>}
                    </article>
                  ))}
                </div>
                <p className="border-t border-border mt-7 pt-5 text-[11px] text-muted-foreground">{BUYER_GUIDE_DISCLAIMER}</p>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { useState } from "react";
import { CheckCircle2Icon, ChevronDownIcon, LightbulbIcon, MessageSquareHeartIcon, SendIcon, ShieldAlertIcon, WrenchIcon, BoxIcon } from "lucide-react";
import { Screen } from "../components/ui/Screen";
import { useApp } from "../context/AppContext";
import { FeedbackEntry } from "../lib/types";
const TOPICS: {
  id: FeedbackEntry['category'];
  label: string;
  Icon: typeof MessageSquareHeartIcon;
  detail: string;
}[] = [{
  id: 'feedback',
  label: 'Share feedback',
  Icon: MessageSquareHeartIcon,
  detail: 'Tell us what would make SilentSOS clearer or safer.'
}, {
  id: 'bug',
  label: 'Report a problem',
  Icon: WrenchIcon,
  detail: 'Describe what happened and what you expected instead.'
}, {
  id: 'help',
  label: 'Get setup help',
  Icon: BoxIcon,
  detail: 'Ask about contacts, triggers, permissions, or evidence.'
}];
const FAQ = [['How do I cancel an alert?', 'After a trigger, use the large Cancel button during the five-second countdown. Once sent, use I’m Safe — Stop to end active capture.'], ['Is my information shared automatically?', 'Only the emergency contacts you configure receive alert updates. This prototype stores setup, evidence records, and feedback on this device.'], ['Why are permissions needed?', 'Camera, microphone, location, and storage permissions allow SilentSOS to capture and retain evidence during an alert.']];
export function Support() {
  const {
    addFeedback,
    feedback
  } = useApp();
  const [category, setCategory] = useState<FeedbackEntry['category']>('feedback');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const submit = () => {
    const clean = message.trim();
    if (!clean) return;
    addFeedback({
      category,
      message: clean
    });
    setMessage('');
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };
  return <Screen title="Feedback & support" back>
      <section className="rounded-[1.75rem] border border-[#ff1744]/20 bg-[#ff1744]/[0.07] p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff1744]">
          <ShieldAlertIcon size={23} color="#fff" />
        </div>
        <h1 className="mt-4 text-xl font-black">Help should never slow you down.</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">Find quick answers, report an issue, or leave feedback. Messages are saved privately on this device for this prototype.</p>
      </section>

      <p className="mb-2 mt-6 px-1 text-xs font-black uppercase tracking-[0.16em] text-white/40">How can we help?</p>
      <div className="grid gap-2">
        {TOPICS.map(({
        id,
        label,
        detail,
        Icon
      }) => {
        const active = id === category;
        return <button key={id} onClick={() => setCategory(id)} className="flex items-center gap-3 rounded-2xl border p-4 text-left" style={{
          borderColor: active ? '#ff1744' : 'rgba(255,255,255,0.1)',
          backgroundColor: active ? 'rgba(255,23,68,0.1)' : 'rgba(255,255,255,0.03)'
        }}>
            <Icon size={20} color={active ? '#ff1744' : '#fff'} />
            <div className="flex-1"><p className="text-sm font-black">{label}</p><p className="mt-0.5 text-xs text-white/45">{detail}</p></div>
            {active && <CheckCircle2Icon size={18} color="#ff1744" />}
          </button>;
      })}
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="text-sm font-black">Your message</label>
        <textarea value={message} onChange={(event) => {
        setMessage(event.target.value);
        setSent(false);
      }} rows={5} placeholder="Write the details here…" className="mt-3 w-full resize-none rounded-xl bg-black/40 p-3 text-sm outline-none placeholder:text-white/25 focus:ring-1 focus:ring-[#ff1744]" />
        <button disabled={!message.trim()} onClick={submit} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff1744] text-sm font-black disabled:opacity-35"><SendIcon size={17} /> Send locally</button>
        {sent && <p role="status" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#00e676]"><CheckCircle2Icon size={15} /> Your message has been saved.</p>}
      </section>

      <p className="mb-2 mt-6 px-1 text-xs font-black uppercase tracking-[0.16em] text-white/40">Quick answers</p>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {FAQ.map(([question, answer], index) => <button key={question} onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full border-b border-white/5 p-4 text-left last:border-0">
          <span className="flex items-center gap-3 text-sm font-bold"><LightbulbIcon size={17} color="#ff9100" /><span className="flex-1">{question}</span><ChevronDownIcon className={openFaq === index ? 'rotate-180 transition-transform' : 'transition-transform'} size={17} color="#888" /></span>
          {openFaq === index && <p className="ml-8 mt-3 pr-2 text-xs leading-relaxed text-white/50">{answer}</p>}
        </button>)}
      </section>

      {feedback.length > 0 && <p className="mt-5 text-center text-xs text-white/35">{feedback.filter((item: FeedbackEntry) => item.status === 'open').length} open support message{feedback.filter((item: FeedbackEntry) => item.status === 'open').length === 1 ? '' : 's'} on this device.</p>}
    </Screen>;
}
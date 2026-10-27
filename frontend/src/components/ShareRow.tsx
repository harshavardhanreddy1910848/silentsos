import { MessageCircleIcon, MessageSquareIcon, MailIcon, LinkIcon } from 'lucide-react';

interface Props {
  name: string;
  type: string;
  link: string;
  coords: string;
}

function buildMessage({ name, type, link, coords }: Props) {
  return (
    `🚨 EMERGENCY ALERT — SilentSOS\n` +
    `From: ${name}\n` +
    `Type: ${type}\n\n` +
    `📍 Location: ${link}\n` +
    `Coordinates: ${coords}\n\n` +
    `⚠️ Please respond immediately or call emergency services.`);

}

export function ShareRow(props: Props) {
  const msg = buildMessage(props);
  const enc = encodeURIComponent(msg);

  const actions = [
  {
    label: 'WhatsApp',
    Icon: MessageCircleIcon,
    color: '#00e676',
    href: `https://wa.me/?text=${enc}`
  },
  { label: 'SMS', Icon: MessageSquareIcon, color: '#2979ff', href: `sms:?body=${enc}` },
  {
    label: 'Email',
    Icon: MailIcon,
    color: '#ff9100',
    href: `mailto:?subject=${encodeURIComponent('EMERGENCY — SilentSOS')}&body=${enc}`
  }];


  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(props.link || msg);
    } catch {

      /* clipboard unavailable in preview */}
  };

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {actions.map((a) =>
      <a
        key={a.label}
        href={a.href}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3 active:scale-95">
        
          <a.Icon size={22} color={a.color} />
          <span className="text-[11px] font-semibold text-white/70">{a.label}</span>
        </a>
      )}
      <button
        onClick={copyLink}
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3 active:scale-95">
        
        <LinkIcon size={22} color="#fff" />
        <span className="text-[11px] font-semibold text-white/70">Link</span>
      </button>
    </div>);

}
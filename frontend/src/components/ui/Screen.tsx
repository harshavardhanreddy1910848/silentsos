import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';

interface Props {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
}

/** Standard screen wrapper with an optional header. Scrolls within the shell. */
export function Screen({ title, back, right, children, pad = true }: Props) {
  const nav = useNavigate();
  return (
    <div className="flex h-full flex-col">
      {(title || back || right) &&
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#0a0a0a]/95 px-4 py-4 backdrop-blur">
          {back &&
        <button
          onClick={() => nav(-1)}
          aria-label="Go back"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
          
              <ChevronLeftIcon size={24} />
            </button>
        }
          {title &&
        <h1 className="flex-1 text-lg font-extrabold tracking-tight">{title}</h1>
        }
          {right}
        </header>
      }
      <div className={`no-scrollbar flex-1 overflow-y-auto ${pad ? 'px-4 py-4' : ''}`}>
        {children}
      </div>
    </div>);

}
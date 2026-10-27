import { useEffect, useState, useRef, useCallback } from 'react';

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

export function useVoiceTrigger(enabled: boolean, onTrigger: () => void) {
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    if (!enabled) {
      setListening(false);
      return;
    }

    const win = window as unknown as Record<string, SpeechRecognitionConstructor | undefined>;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Web Speech API not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript.toLowerCase();
        }
        setLastTranscript(currentTranscript);

        const keywords = ['help', 'emergency', 'sos', 'help me', 'danger'];
        const matched = keywords.some((kw) => currentTranscript.includes(kw));

        if (matched) {
          recognition.stop();
          onTrigger();
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'no-speech') {
          setError(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Restart automatically if still enabled
        if (enabled) {
          try {
            recognition.start();
          } catch (err) {
            setListening(false);
            console.debug('Voice recognition restart notice:', err);
          }
        } else {
          setListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: unknown) {
      setError('Could not start voice listener.');
      console.debug('Voice trigger start error:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.debug('Voice recognition stop notice:', err);
        }
      }
    };
  }, [enabled, onTrigger]);

  const simulateHelp = useCallback(() => {
    onTrigger();
  }, [onTrigger]);

  return { listening, lastTranscript, error, simulateHelp };
}

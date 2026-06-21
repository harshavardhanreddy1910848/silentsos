import React from 'react';
import { useApp } from '../AppContext';
import {
  History as HistoryIcon,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle } from
'lucide-react';
import { format } from 'date-fns';
export function History() {
  const { state, refreshHistory } = useApp();

  React.useEffect(() => {
    refreshHistory();
  }, []);

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24">
      <h1 className="text-2xl font-bold mb-6">Alert History</h1>

      {state.history.length === 0 ?
      <div className="flex-1 flex flex-col items-center justify-center text-textMuted">
          <HistoryIcon className="w-16 h-16 mb-4 opacity-20" />
          <p>No alerts triggered yet.</p>
        </div> :

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surfaceHighlight before:to-transparent">
          {state.history.map((event) =>
        <div
          key={event.id}
          className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          
              {/* Timeline dot */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-surfaceHighlight text-textMuted shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                {event.status === 'Sent' ?
            <CheckCircle2 className="w-5 h-5 text-safe" /> :
            event.status === 'Cancelled' ?
            <XCircle className="w-5 h-5 text-textMuted" /> :

            <AlertCircle className="w-5 h-5 text-warning" />
            }
              </div>

              {/* Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-surface border border-surfaceHighlight p-4 rounded-xl shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{event.type} Alert</span>
                  <span className="text-xs text-textMuted">
                    {format(event.timestamp, 'MMM d, h:mm a')}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-textMuted">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-2" /> Duration:{' '}
                    {event.durationSeconds}s
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 mr-2" /> {event.gpsPath.length}{' '}
                    Location updates
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-2" />{' '}
                    {
                event.contactsNotified.filter((c) => c.status === 'Sent').
                length
                }{' '}
                    Contacts notified
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-surfaceHighlight flex gap-2">
                  <span className="bg-surfaceHighlight px-2 py-1 rounded text-[10px]">
                    {event.evidence.photos} Photos
                  </span>
                  <span className="bg-surfaceHighlight px-2 py-1 rounded text-[10px]">
                    {event.evidence.videos} Videos
                  </span>
                </div>
              </div>
            </div>
        )}
        </div>
      }
    </div>);

}
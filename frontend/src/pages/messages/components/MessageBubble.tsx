import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import type { Message } from '../../../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
}

export function MessageBubble({ message, isOwn, showTimestamp = true }: MessageBubbleProps) {
  return (
    <div className={clsx('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isOwn
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        )}
      >
        {/* Quoted text */}
        {message.quotedProfileText && (
          <div
            className={clsx(
              'text-sm mb-2 pb-2 border-b',
              isOwn ? 'border-primary-400 opacity-80' : 'border-gray-300'
            )}
          >
            <span className="text-xs opacity-70">Citation :</span>
            <p className="italic font-serif">"{message.quotedProfileText}"</p>
          </div>
        )}

        {/* Message content */}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {/* Timestamp and status */}
        {showTimestamp && (
          <div
            className={clsx(
              'flex items-center justify-end gap-1 mt-1 text-xs',
              isOwn ? 'text-primary-200' : 'text-gray-500'
            )}
          >
            <span>
              {format(new Date(message.createdAt), 'HH:mm', { locale: fr })}
            </span>
            {isOwn && (
              <span>
                {message.isRead ? (
                  <CheckDoubleIcon className="w-4 h-4" />
                ) : (
                  <CheckIcon className="w-4 h-4" />
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CheckDoubleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

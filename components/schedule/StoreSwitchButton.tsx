'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

export function StoreSwitchButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors relative overflow-hidden disabled:cursor-not-allowed"
            style={{
                borderColor: '#e8c99a',
                color: pending ? 'transparent' : '#8b5e3c',
                background: '#fffaf2'
            }}
        >
            <span className={pending ? 'opacity-0' : 'opacity-100'}>{children}</span>
            {pending && (
                <div className="absolute inset-0 flex items-center justify-center text-orange-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                </div>
            )}
        </button>
    );
}

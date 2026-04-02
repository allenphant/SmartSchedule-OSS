'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

interface StoreSelectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function StoreSelectButton({ children, className, ...props }: StoreSelectButtonProps) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className={`${className} relative overflow-hidden`}
            {...props}
        >
            <div className={`transition-opacity duration-200 ${pending ? 'opacity-0' : 'opacity-100'} w-full flex items-center justify-between`}>
                {children}
            </div>

            {pending && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 text-orange-600 font-bold gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>切換中...</span>
                </div>
            )}
        </button>
    );
}

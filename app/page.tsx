import { redirect } from 'next/navigation';

export default function Home() {
    redirect('/schedule');
    
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">SmartSchedule</h1>
                <p className="text-gray-600">智能排班系統</p>
            </div>
        </div>
    );
}

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ChatSettings } from '@/components/seo-chat/ChatSettings';
import { Button } from '@tevero/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function SeoChatSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/seo-chat">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">SEO Chat Settings</h1>

      <ChatSettings />
    </div>
  );
}

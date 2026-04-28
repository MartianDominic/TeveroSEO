/**
 * Voice Settings Tabs
 * Phase 37-05: Voice Settings UI
 *
 * Tabbed interface container with 5 tabs:
 * - Tone: Mode, primary/secondary tone, formality, archetype, personality
 * - Vocabulary: Preferred/avoided words, signature/forbidden phrases
 * - Writing: Sentence/paragraph length, contractions, heading style
 * - Protection: Protection rules editor
 * - Preview: Sample generation with compliance scoring
 */
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { ToneTab } from "./ToneTab";
import { VocabularyTab } from "./VocabularyTab";
import { WritingTab } from "./WritingTab";
import { ProtectionTab } from "./ProtectionTab";
import { VoicePreviewSuite } from "./VoicePreviewSuite";
import type { VoiceProfileSelect } from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

export function VoiceSettingsTabs({ profile, clientId }: Props) {
  return (
    <Tabs defaultValue="tone" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="tone">Tone</TabsTrigger>
        <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
        <TabsTrigger value="writing">Writing</TabsTrigger>
        <TabsTrigger value="protection">Protection</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="tone" className="mt-4">
        <ToneTab profile={profile} clientId={clientId} />
      </TabsContent>

      <TabsContent value="vocabulary" className="mt-4">
        <VocabularyTab profile={profile} clientId={clientId} />
      </TabsContent>

      <TabsContent value="writing" className="mt-4">
        <WritingTab profile={profile} clientId={clientId} />
      </TabsContent>

      <TabsContent value="protection" className="mt-4">
        <ProtectionTab profile={profile} clientId={clientId} />
      </TabsContent>

      <TabsContent value="preview" className="mt-4">
        <VoicePreviewSuite profile={profile} clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}

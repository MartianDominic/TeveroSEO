/**
 * Vocabulary Settings Tab
 * Phase 37-05: Voice Settings UI
 *
 * Controls for vocabulary patterns:
 * - Preferred words (tag input)
 * - Avoided words (tag input)
 * - Signature phrases (textarea, one per line)
 * - Forbidden phrases (textarea, one per line)
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Plus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { Badge } from "@/client/components/ui/badge";
import { updateVoiceProfileFn } from "@/serverFunctions/voice";
import type { VoiceProfileSelect, VocabularyPatterns } from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

export function VocabularyTab({ profile, clientId }: Props) {
  const queryClient = useQueryClient();

  // Local form state
  const [preferredWords, setPreferredWords] = useState<string[]>(
    profile.vocabularyPatterns?.preferred ?? []
  );
  const [avoidedWords, setAvoidedWords] = useState<string[]>(
    profile.vocabularyPatterns?.avoided ?? []
  );
  const [signaturePhrases, setSignaturePhrases] = useState<string[]>(
    profile.signaturePhrases ?? []
  );
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>(
    profile.forbiddenPhrases ?? []
  );

  // Input states for adding new words
  const [newPreferred, setNewPreferred] = useState("");
  const [newAvoided, setNewAvoided] = useState("");

  const updateMutation = useMutation({
    mutationFn: updateVoiceProfileFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-profile", clientId] });
    },
  });

  const handleSave = () => {
    const vocabularyPatterns: VocabularyPatterns = {
      preferred: preferredWords,
      avoided: avoidedWords,
    };

    updateMutation.mutate({
      data: {
        profileId: profile.id,
        vocabularyPatterns,
        signaturePhrases: signaturePhrases.filter((p) => p.trim()),
        forbiddenPhrases: forbiddenPhrases.filter((p) => p.trim()),
      },
    });
  };

  const addWord = (
    type: "preferred" | "avoided",
    word: string,
    setWord: (s: string) => void
  ) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;

    if (type === "preferred") {
      if (!preferredWords.includes(trimmed)) {
        setPreferredWords([...preferredWords, trimmed]);
      }
    } else {
      if (!avoidedWords.includes(trimmed)) {
        setAvoidedWords([...avoidedWords, trimmed]);
      }
    }
    setWord("");
  };

  const removeWord = (type: "preferred" | "avoided", word: string) => {
    if (type === "preferred") {
      setPreferredWords(preferredWords.filter((w) => w !== word));
    } else {
      setAvoidedWords(avoidedWords.filter((w) => w !== word));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    type: "preferred" | "avoided",
    word: string,
    setWord: (s: string) => void
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWord(type, word, setWord);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preferred Words */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferred Words</CardTitle>
          <CardDescription>
            Words and terms that should be used frequently in content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a preferred word..."
              value={newPreferred}
              onChange={(e) => setNewPreferred(e.target.value)}
              onKeyDown={(e) =>
                handleKeyDown(e, "preferred", newPreferred, setNewPreferred)
              }
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                addWord("preferred", newPreferred, setNewPreferred)
              }
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {preferredWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No preferred words added yet
              </p>
            ) : (
              preferredWords.map((word) => (
                <Badge
                  key={word}
                  variant="default"
                  className="flex items-center gap-1 pr-1"
                >
                  {word}
                  <button
                    onClick={() => removeWord("preferred", word)}
                    className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Avoided Words */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avoided Words</CardTitle>
          <CardDescription>
            Words and terms that should not be used in content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a word to avoid..."
              value={newAvoided}
              onChange={(e) => setNewAvoided(e.target.value)}
              onKeyDown={(e) =>
                handleKeyDown(e, "avoided", newAvoided, setNewAvoided)
              }
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => addWord("avoided", newAvoided, setNewAvoided)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {avoidedWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No avoided words added yet
              </p>
            ) : (
              avoidedWords.map((word) => (
                <Badge
                  key={word}
                  variant="destructive"
                  className="flex items-center gap-1 pr-1"
                >
                  {word}
                  <button
                    onClick={() => removeWord("avoided", word)}
                    className="ml-1 hover:bg-destructive-foreground/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signature Phrases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signature Phrases</CardTitle>
          <CardDescription>
            Phrases that define the brand voice (one per line)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={"Your success is our priority\nTogether we achieve more\nExcellence in every detail"}
            value={signaturePhrases.join("\n")}
            onChange={(e) =>
              setSignaturePhrases(e.target.value.split("\n"))
            }
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {signaturePhrases.filter((p) => p.trim()).length} phrase(s) defined
          </p>
        </CardContent>
      </Card>

      {/* Forbidden Phrases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden Phrases</CardTitle>
          <CardDescription>
            Phrases that must never appear in content (one per line)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={"Act now before it's too late\nGuaranteed results\nNo questions asked"}
            value={forbiddenPhrases.join("\n")}
            onChange={(e) =>
              setForbiddenPhrases(e.target.value.split("\n"))
            }
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {forbiddenPhrases.filter((p) => p.trim()).length} phrase(s) blocked
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

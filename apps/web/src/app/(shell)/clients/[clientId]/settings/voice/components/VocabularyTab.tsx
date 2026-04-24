"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@tevero/ui";
import { X } from "lucide-react";
import type { VoiceProfile } from "@/lib/voiceApi";

interface VocabularyTabProps {
  profile: VoiceProfile | null;
  onSave: (data: Partial<VoiceProfile>) => Promise<void>;
  saving: boolean;
}

const JARGON_LEVELS = ["none", "light", "moderate", "heavy"] as const;
const ACRONYM_POLICIES = ["always_expand", "first_use", "assume_known"] as const;

export function VocabularyTab({ profile, onSave, saving }: VocabularyTabProps) {
  const [jargonLevel, setJargonLevel] = useState(profile?.jargonLevel ?? "moderate");
  const [acronymPolicy, setAcronymPolicy] = useState(profile?.acronymPolicy ?? "first_use");
  const [industryTerms, setIndustryTerms] = useState<string[]>(profile?.industryTerms ?? []);
  const [signaturePhrases, setSignaturePhrases] = useState<string[]>(
    profile?.signaturePhrases ?? []
  );
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>(
    profile?.forbiddenPhrases ?? []
  );
  const [newTerm, setNewTerm] = useState("");
  const [newSignature, setNewSignature] = useState("");
  const [newForbidden, setNewForbidden] = useState("");

  const addToList = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (item && !list.includes(item)) {
      setList([...list, item]);
    }
  };

  const removeFromList = (list: string[], setList: (l: string[]) => void, item: string) => {
    setList(list.filter((i) => i !== item));
  };

  const handleSave = useCallback(async () => {
    await onSave({
      jargonLevel,
      acronymPolicy,
      industryTerms,
      signaturePhrases,
      forbiddenPhrases,
    });
  }, [jargonLevel, acronymPolicy, industryTerms, signaturePhrases, forbiddenPhrases, onSave]);

  return (
    <div className="space-y-6">
      {/* Jargon Level */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Jargon Level</Label>
        <p className="text-xs text-muted-foreground mb-2">
          How much industry-specific terminology to use
        </p>
        <Select value={jargonLevel} onValueChange={setJargonLevel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JARGON_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Acronym Policy */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Acronym Policy</Label>
        <Select value={acronymPolicy} onValueChange={setAcronymPolicy}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always_expand">Always Expand</SelectItem>
            <SelectItem value="first_use">Expand on First Use</SelectItem>
            <SelectItem value="assume_known">Assume Known</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Industry Terms */}
      <Card className="p-4 space-y-3">
        <Label className="text-sm font-medium">Industry Terms</Label>
        <div className="flex gap-2">
          <Input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="Add industry term..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addToList(industryTerms, setIndustryTerms, newTerm);
                setNewTerm("");
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              addToList(industryTerms, setIndustryTerms, newTerm);
              setNewTerm("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {industryTerms.map((term) => (
            <Badge key={term} variant="secondary" className="gap-1">
              {term}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFromList(industryTerms, setIndustryTerms, term)}
              />
            </Badge>
          ))}
        </div>
      </Card>

      {/* Signature Phrases */}
      <Card className="p-4 space-y-3">
        <Label className="text-sm font-medium">Signature Phrases</Label>
        <p className="text-xs text-muted-foreground">
          Phrases that should appear frequently in content
        </p>
        <div className="flex gap-2">
          <Input
            value={newSignature}
            onChange={(e) => setNewSignature(e.target.value)}
            placeholder="Add signature phrase..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addToList(signaturePhrases, setSignaturePhrases, newSignature);
                setNewSignature("");
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              addToList(signaturePhrases, setSignaturePhrases, newSignature);
              setNewSignature("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {signaturePhrases.map((phrase) => (
            <Badge key={phrase} variant="default" className="gap-1">
              {phrase}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  removeFromList(signaturePhrases, setSignaturePhrases, phrase)
                }
              />
            </Badge>
          ))}
        </div>
      </Card>

      {/* Forbidden Phrases */}
      <Card className="p-4 space-y-3">
        <Label className="text-sm font-medium">Forbidden Phrases</Label>
        <p className="text-xs text-muted-foreground">
          Words or phrases that should never appear
        </p>
        <div className="flex gap-2">
          <Input
            value={newForbidden}
            onChange={(e) => setNewForbidden(e.target.value)}
            placeholder="Add forbidden phrase..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addToList(forbiddenPhrases, setForbiddenPhrases, newForbidden);
                setNewForbidden("");
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              addToList(forbiddenPhrases, setForbiddenPhrases, newForbidden);
              setNewForbidden("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {forbiddenPhrases.map((phrase) => (
            <Badge key={phrase} variant="destructive" className="gap-1">
              {phrase}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  removeFromList(forbiddenPhrases, setForbiddenPhrases, phrase)
                }
              />
            </Badge>
          ))}
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Vocabulary"}
        </Button>
      </div>
    </div>
  );
}

export interface VoiceProfile {
  name: string;
  sentenceRhythm: string;
  openerPattern: string;
  metaphorDomain?: string;
  bannedPhrases: string[];
  signatureMove?: string;
  closingStyle: string;
  contractionFrequency: string;
  examples: string[];
}

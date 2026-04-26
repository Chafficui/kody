export const DEFAULT_BLOCKED_INPUT_PATTERNS = [
  "ignore (?:all )?(?:previous|prior|above) (?:instructions|prompts|directives)",
  "disregard (?:all )?(?:previous|prior|above) (?:instructions|prompts|directives)",
  "forget (?:all )?(?:previous|prior|above) (?:instructions|prompts|directives)",
  "you are now (?:a |an )?(?:different|new)",
  "act as (?:a |an )?(?:different|new)",
  "pretend (?:you are|to be) (?:a |an )?(?:different|new)",
  "switch to (?:a |an )?(?:different|new) (?:role|persona|mode)",
  "enter (?:developer|debug|admin|god|sudo|root) mode",
  "(?:reveal|show|display|print|output|repeat) (?:me )?(?:your |the )?(?:system |initial )?(?:prompt|instructions|directives|configuration)",
  "what (?:are|were) your (?:system |initial )?(?:prompt|instructions|directives)",
  "\\[system\\]",
  "\\[INST\\]",
  "<\\|(?:system|im_start|im_end)\\|>",
  "<<SYS>>",
  "OVERRIDE:",
  "ADMIN:",
  "SUDO:",
] as const;

export type BlockedPattern = (typeof DEFAULT_BLOCKED_INPUT_PATTERNS)[number];

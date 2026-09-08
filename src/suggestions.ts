export type Language =
    | "am"
    | "ar"
    | "bn"
    | "be"
    | "bg"
    | "yue-hant"
    | "zh"
    | "zh-hant"
    | "fr"
    | "de"
    | "el"
    | "gu"
    | "he"
    | "hi"
    | "it"
    | "ja"
    | "kn"
    | "ml"
    | "mr"
    | "ne"
    | "or"
    | "fa"
    | "pt"
    | "pa"
    | "ru"
    | "sa"
    | "sr"
    | "si"
    | "es"
    | "ta"
    | "te"
    | "ti"
    | "uk"
    | "ur"
    | "vi";

/** Options for the optional Google Input Tools adapter. */
export interface SuggestionOptions {
    numOptions?: number;
    showCurrentWordAsLastSuggestion?: boolean;
    lang?: Language;
    signal?: AbortSignal;
}

/** Fetch suggestions from the unofficial Google Input Tools endpoint.
 * Failures return the original word (if enabled) or an empty list.
 * Aborted requests always return an empty list.
 */
export async function getTransliterateSuggestions(
    word: string,
    { numOptions = 5, showCurrentWordAsLastSuggestion = true, lang = "hi", signal }: SuggestionOptions = {},
): Promise<string[]> {
    if (!word.trim() || signal?.aborted) return [];
    const limit = Number.isFinite(numOptions) ? Math.max(1, Math.min(10, Math.floor(numOptions))) : 5;
    const params = new URLSearchParams({
        text: word, itc: `${lang}-t-i0-und`, num: String(limit),
        cp: "0", cs: "1", ie: "utf-8", oe: "utf-8", app: "demopage",
    });
    let suggestions: string[] = [];
    try {
        const response = await fetch(`https://inputtools.google.com/request?${params}`, { signal });
        if (response.ok) {
            const data: unknown = await response.json();
            if (Array.isArray(data) && data[0] === "SUCCESS" && Array.isArray(data[1])) {
                const result: unknown = data[1][0];
                if (Array.isArray(result) && Array.isArray(result[1])) {
                    suggestions = result[1].filter((item: unknown): item is string => typeof item === "string" && item.length > 0);
                }
            }
        }
    } catch {
        // A provider outage must never prevent normal editor input.
    }
    if (signal?.aborted) return [];
    const result = [...new Set(suggestions)].slice(0, limit);
    return showCurrentWordAsLastSuggestion ? [...result.filter(item => item !== word), word] : result;
}

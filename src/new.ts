import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Language } from "./suggestions";


type Action =
    | { type: "setSuggestions"; suggestions: string[]; from: number; to: number; word: string }
    | { type: "clear" }
    | { type: "move"; dir: 1 | -1 }

/* ------------------------------------------------ */
/* Language Types                                   */
/* ------------------------------------------------ */



/* ------------------------------------------------ */
/* Config                                           */
/* ------------------------------------------------ */

type Config = {
    numOptions?: number;
    lang?: Language;
    debounceMs?: number;
};

/* ------------------------------------------------ */
/* Google API                                       */
/* ------------------------------------------------ */

async function getSuggestions(
    word: string,
    config: Config
): Promise<string[]> {

    const url =
        `https://inputtools.google.com/request?text=${word}` +
        `&itc=${config.lang}-t-i0-und&num=${config.numOptions}` +
        `&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data?.[0] === "SUCCESS") {
            return data[1][0][1];
        }

        return [];
    } catch {
        return [];
    }
}

/* ------------------------------------------------ */
/* Plugin State                                     */
/* ------------------------------------------------ */

type SuggestionState = {
    suggestions: string[];
    index: number;
    from: number;
    to: number;
    word: string | null;
};

const key = new PluginKey<SuggestionState>("transliteration");

/* ------------------------------------------------ */
/* Popup                                            */
/* ------------------------------------------------ */

function createPopup() {
    const el = document.createElement("div");

    Object.assign(el.style, {
        position: "absolute",
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "6px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        fontFamily: "sans-serif",
        fontSize: "14px",
        zIndex: "1000"
    });

    document.body.appendChild(el);
    return el;
}

function renderPopup(
    view: EditorView,
    popup: HTMLDivElement,
    state: SuggestionState
) {

    popup.innerHTML = "";

    const coords = view.coordsAtPos(state.to);

    popup.style.left = coords.left + "px";
    popup.style.top = coords.bottom + "px";

    state.suggestions.forEach((s, i) => {
        const item = document.createElement("div");

        item.textContent = s;

        Object.assign(item.style, {
            padding: "6px 10px",
            cursor: "pointer",
            background: i === state.index ? "#eee" : ""
        });

        item.onclick = () => {
            replaceWord(view, state.from, state.to, s);
            popup.style.display = "none";
        };

        popup.appendChild(item);
    });

    popup.style.display = state.suggestions.length ? "block" : "none";
}

/* ------------------------------------------------ */
/* Word Detection                                   */
/* ------------------------------------------------ */

function detectWord(view: EditorView) {

    const { $from } = view.state.selection;

    const text = $from.parent.textBetween(
        0,
        $from.parentOffset,
        null,
        "\ufffc"
    );

    const match = text.match(/([a-zA-Z]+)$/);

    if (!match) return null;

    const word = match[1];

    return {
        word,
        from: $from.pos - word.length,
        to: $from.pos
    };
}

/* ------------------------------------------------ */
/* Replace Word                                     */
/* ------------------------------------------------ */

function replaceWord(
    view: EditorView,
    from: number,
    to: number,
    text: string
) {

    view.dispatch(
        view.state.tr.insertText(text, from, to)
    );
}

/* ------------------------------------------------ */
/* Plugin                                           */
/* ------------------------------------------------ */

export function NewtransliterationPlugin(config: Config = {}) {

    const cfg: Required<Config> = {
        lang: config.lang ?? "hi",
        numOptions: config.numOptions ?? 5,
        debounceMs: config.debounceMs ?? 150
    };

    let popup: HTMLDivElement | null = null;
    let timer: any = null;
    let requestId = 0;

    return new Plugin<SuggestionState>({
        key,

        state: {
            init() {
                return {
                    suggestions: [],
                    index: 0,
                    from: 0,
                    to: 0,
                    word: null
                }
            },

            apply(tr, prev) {

                const action = tr.getMeta(key)

                if (!action) return prev

                if (action.type === "setSuggestions") {
                    return {
                        suggestions: action.suggestions,
                        index: 0,
                        from: action.from,
                        to: action.to,
                        word: action.word
                    }
                }

                if (action.type === "clear") {
                    return {
                        ...prev,
                        suggestions: []
                    }
                }

                if (action.type === "move") {
                    if (!prev.suggestions.length) return prev

                    const len = prev.suggestions.length

                    return {
                        ...prev,
                        index: (prev.index + action.dir + len) % len
                    }
                }

                return prev
            }
        },

        view(view) {

            popup = createPopup();

            return {
                destroy() {
                    popup?.remove();
                },

                update(view) {
                    const state = key.getState(view.state);
                    if (!state || !popup) return;

                    renderPopup(view, popup, state);
                }
            };
        },

        props: {

            handleTextInput(view) {

                clearTimeout(timer);

                timer = setTimeout(async () => {

                    const result = detectWord(view);

                    if (!result) {
                        view.dispatch(view.state.tr);
                        return;
                    }

                    const id = ++requestId;

                    const suggestions = await getSuggestions(result.word, cfg);

                    if (id !== requestId) return;

                    const pluginState = key.getState(view.state);
                    if (!pluginState) return;

                    pluginState.suggestions = suggestions;
                    pluginState.index = 0;
                    pluginState.from = result.from;
                    pluginState.to = result.to;
                    pluginState.word = result.word;

                    view.updateState(view.state);
                }, cfg.debounceMs);

                return false;
            },

            handleKeyDown(view, event) {

                const state = key.getState(view.state);

                if (!state || !state.suggestions.length) return false;

                /* Arrow Down */

                if (event.key === "ArrowDown") {

                    event.preventDefault();

                    state.index =
                        (state.index + 1) % state.suggestions.length;

                    view.updateState(view.state);
                    return true;
                }

                /* Arrow Up */

                if (event.key === "ArrowUp") {

                    event.preventDefault();

                    state.index =
                        (state.index - 1 + state.suggestions.length)
                        % state.suggestions.length;

                    view.updateState(view.state);
                    return true;
                }

                /* Enter */

                if (event.key === "Enter") {

                    event.preventDefault();

                    replaceWord(
                        view,
                        state.from,
                        state.to,
                        state.suggestions[state.index]
                    );

                    state.suggestions = [];
                    return true;
                }

                /* Space */

                if (event.key === " ") {

                    const { $from } = view.state.selection;

                    const prevChar = $from.parent.textBetween(
                        Math.max(0, $from.parentOffset - 1),
                        $from.parentOffset
                    );

                    if (prevChar === " ") return false;

                    event.preventDefault();

                    replaceWord(
                        view,
                        state.from,
                        state.to,
                        state.suggestions[0]
                    );

                    view.dispatch(
                        view.state.tr.insertText(" ")
                    );

                    state.suggestions = [];
                    return true;
                }

                /* Escape */

                if (event.key === "Escape") {

                    state.suggestions = [];
                    view.updateState(view.state);

                    return true;
                }

                return false;
            }
        }
    });
}
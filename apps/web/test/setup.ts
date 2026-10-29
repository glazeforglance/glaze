// Every test runs with i18next started in English, like the app before its
// first render. English is forced: the machine's own language mustn't matter.
import { i18n, initI18n } from "../src/i18n.ts";

await initI18n();
await i18n.changeLanguage("en");

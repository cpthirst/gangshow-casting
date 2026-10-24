import "@fontsource-variable/nunito-sans";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "@/assets/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import { createApp } from "vue";
import { createAppRouter } from "@/router/index.ts";
import { startSignIn } from "@/services/cognito-sign-in.ts";
import App from "./App.vue";

// Its stylesheet is bundled above, so Font Awesome needn't add a <style> tag at runtime.
config.autoAddCss = false;

await startSignIn({ devServer: import.meta.env.DEV });

createApp(App).use(createAppRouter()).mount("#app");

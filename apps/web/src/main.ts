import "@fontsource-variable/nunito-sans";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import { createApp } from "vue";
import App from "./App.vue";
import { startSignIn } from "./cognito-sign-in.ts";
import { createAppRouter } from "./router.ts";

// Its stylesheet is bundled above, so Font Awesome needn't add a <style> tag at runtime.
config.autoAddCss = false;

await startSignIn({ devServer: import.meta.env.DEV });

createApp(App).use(createAppRouter()).mount("#app");

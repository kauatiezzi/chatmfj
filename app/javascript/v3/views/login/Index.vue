<script>
// utils and composables
import { login } from '../../api/auth';
import { mapGetters } from 'vuex';
import { useAlert } from 'dashboard/composables';
import { required, email } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';
import { SESSION_STORAGE_KEYS } from 'dashboard/constants/sessionStorage';
import SessionStorage from 'shared/helpers/sessionStorage';
import { useBranding } from 'shared/composables/useBranding';

// components
import SimpleDivider from '../../components/Divider/SimpleDivider.vue';
import FormInput from '../../components/Form/Input.vue';
import GoogleOAuthButton from '../../components/GoogleOauth/Button.vue';
import Spinner from 'shared/components/Spinner.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import MfaVerification from 'dashboard/components/auth/MfaVerification.vue';

const ERROR_MESSAGES = {
  'no-account-found': 'LOGIN.OAUTH.NO_ACCOUNT_FOUND',
  'business-account-only': 'LOGIN.OAUTH.BUSINESS_ACCOUNTS_ONLY',
  'saml-authentication-failed': 'LOGIN.SAML.API.ERROR_MESSAGE',
  'saml-not-enabled': 'LOGIN.SAML.API.ERROR_MESSAGE',
};

const IMPERSONATION_URL_SEARCH_KEY = 'impersonation';
const USER_NOT_CONFIRMED_ERROR_CODE = 'user_not_confirmed';

export default {
  components: {
    FormInput,
    GoogleOAuthButton,
    Spinner,
    NextButton,
    SimpleDivider,
    MfaVerification,
    Icon,
  },
  props: {
    ssoAuthToken: { type: String, default: '' },
    ssoAccountId: { type: String, default: '' },
    ssoConversationId: { type: String, default: '' },
    email: { type: String, default: '' },
    authError: { type: String, default: '' },
  },
  setup() {
    const { replaceInstallationName } = useBranding();
    return {
      replaceInstallationName,
      v$: useVuelidate(),
    };
  },
  data() {
    return {
      // We need to initialize the component with any
      // properties that will be used in it
      credentials: {
        email: '',
        password: '',
      },
      loginApi: {
        message: '',
        showLoading: false,
        hasErrored: false,
      },
      error: '',
      mfaRequired: false,
      mfaToken: null,
    };
  },
  validations() {
    return {
      credentials: {
        password: {
          required,
        },
        email: {
          required,
          email,
        },
      },
    };
  },
  computed: {
    ...mapGetters({ globalConfig: 'globalConfig/get' }),
    allowedLoginMethods() {
      return window.chatwootConfig.allowedLoginMethods || ['email'];
    },
    showGoogleOAuth() {
      return (
        this.allowedLoginMethods.includes('google_oauth') &&
        Boolean(window.chatwootConfig.googleOAuthClientId)
      );
    },
    showSignupLink() {
      return window.chatwootConfig.signupEnabled === 'true';
    },
    showSamlLogin() {
      return this.allowedLoginMethods.includes('saml');
    },
    brandMark() {
      return this.globalConfig.brandName || 'MFJ';
    },
  },
  created() {
    if (this.ssoAuthToken) {
      this.submitLogin();
    }
    if (this.authError) {
      const messageKey = ERROR_MESSAGES[this.authError] ?? 'LOGIN.API.UNAUTH';
      // Use a method to get the translated text to avoid dynamic key warning
      const translatedMessage = this.getTranslatedMessage(messageKey);
      useAlert(translatedMessage);
      // wait for idle state
      this.requestIdleCallbackPolyfill(() => {
        // Remove the error query param from the url
        const { query } = this.$route;
        this.$router.replace({ query: { ...query, error: undefined } });
      });
    }
  },
  methods: {
    getTranslatedMessage(key) {
      // Avoid dynamic key warning by handling each case explicitly
      switch (key) {
        case 'LOGIN.OAUTH.NO_ACCOUNT_FOUND':
          return this.$t('LOGIN.OAUTH.NO_ACCOUNT_FOUND');
        case 'LOGIN.OAUTH.BUSINESS_ACCOUNTS_ONLY':
          return this.$t('LOGIN.OAUTH.BUSINESS_ACCOUNTS_ONLY');
        case 'LOGIN.API.UNAUTH':
        default:
          return this.$t('LOGIN.API.UNAUTH');
      }
    },
    // TODO: Remove this when Safari gets wider support
    // Ref: https://caniuse.com/requestidlecallback
    //
    requestIdleCallbackPolyfill(callback) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(callback);
      } else {
        // Fallback for safari
        // Using a delay of 0 allows the callback to be executed asynchronously
        // in the next available event loop iteration, similar to requestIdleCallback
        setTimeout(callback, 0);
      }
    },
    showAlertMessage(message) {
      // Reset loading, current selected agent
      this.loginApi.showLoading = false;
      this.loginApi.message = message;
      useAlert(this.loginApi.message);
    },
    handleImpersonation() {
      // Detects impersonation mode via URL and sets a session flag to prevent user settings changes during impersonation.
      const urlParams = new URLSearchParams(window.location.search);
      const impersonation = urlParams.get(IMPERSONATION_URL_SEARCH_KEY);
      if (impersonation) {
        SessionStorage.set(SESSION_STORAGE_KEYS.IMPERSONATION_USER, true);
      }
    },
    submitLogin() {
      this.loginApi.hasErrored = false;
      this.loginApi.showLoading = true;

      const credentials = {
        email: this.email
          ? decodeURIComponent(this.email)
          : this.credentials.email,
        password: this.credentials.password,
        sso_auth_token: this.ssoAuthToken,
        ssoAccountId: this.ssoAccountId,
        ssoConversationId: this.ssoConversationId,
      };

      login(credentials)
        .then(result => {
          // Check if MFA is required
          if (result?.mfaRequired) {
            this.loginApi.showLoading = false;
            this.mfaRequired = true;
            this.mfaToken = result.mfaToken;
            return;
          }

          this.handleImpersonation();
          this.showAlertMessage(this.$t('LOGIN.API.SUCCESS_MESSAGE'));
        })
        .catch(response => {
          if (response?.errorCode === USER_NOT_CONFIRMED_ERROR_CODE) {
            this.loginApi.showLoading = false;
            this.$router.push({
              name: 'auth_verify_email',
              state: { email: credentials.email },
            });
            return;
          }

          // Reset URL Params if the authentication is invalid
          if (this.email) {
            window.location = '/app/login';
          }
          this.loginApi.hasErrored = true;
          this.showAlertMessage(
            response?.message || this.$t('LOGIN.API.UNAUTH')
          );
        });
    },
    submitFormLogin() {
      if (this.v$.credentials.email.$invalid && !this.email) {
        this.showAlertMessage(this.$t('LOGIN.EMAIL.ERROR'));
        return;
      }

      this.submitLogin();
    },
    handleMfaVerified() {
      // MFA verification successful, continue with login
      this.handleImpersonation();
      window.location = '/app';
    },
    handleMfaCancel() {
      // User cancelled MFA, reset state
      this.mfaRequired = false;
      this.mfaToken = null;
      this.credentials.password = '';
    },
  },
};
</script>

<template>
  <main
    class="relative flex w-full min-h-screen overflow-hidden bg-[#fffaf5] dark:bg-[#070707]"
  >
    <div
      class="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,107,0,0.2),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(18,165,148,0.13),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(255,239,226,0.44))] dark:bg-[radial-gradient(circle_at_22%_18%,rgba(255,107,0,0.2),transparent_30%),radial-gradient(circle_at_82%_78%,rgba(18,165,148,0.12),transparent_24%),linear-gradient(135deg,#070707,#111112_54%,#1f130b)]"
    />
    <div
      class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-n-brand via-n-amber-9 to-n-teal-9"
    />

    <!-- MFA Verification Section -->
    <section
      v-if="mfaRequired"
      class="relative z-10 flex items-center justify-center w-full px-4 py-10"
    >
      <MfaVerification
        :mfa-token="mfaToken"
        @verified="handleMfaVerified"
        @cancel="handleMfaCancel"
      />
    </section>

    <!-- Regular Login Section -->
    <section
      v-else
      class="relative z-10 grid w-full min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_34rem]"
      :class="{
        'animate-wiggle': loginApi.hasErrored,
      }"
    >
      <div
        class="flex flex-col justify-between min-h-screen px-6 py-8 sm:px-10 lg:px-14"
      >
        <div>
          <img
            :src="globalConfig.logo"
            :alt="globalConfig.installationName"
            class="block w-auto h-9 dark:hidden"
          />
          <img
            v-if="globalConfig.logoDark"
            :src="globalConfig.logoDark"
            :alt="globalConfig.installationName"
            class="hidden w-auto h-9 dark:block"
          />
        </div>
        <div class="max-w-3xl py-16">
          <p class="text-sm font-semibold uppercase text-n-brand">
            {{ brandMark }}
          </p>
          <h1
            class="max-w-3xl mt-5 text-4xl font-semibold leading-tight text-n-slate-12 sm:text-5xl lg:text-6xl"
          >
            {{ globalConfig.installationName }}
          </h1>
          <div class="grid max-w-2xl grid-cols-3 gap-3 mt-10">
            <div
              class="h-24 rounded-lg border border-n-container bg-white/55 p-4 shadow-sm backdrop-blur dark:bg-white/[0.04]"
            >
              <div class="size-8 rounded-md bg-n-brand" />
            </div>
            <div
              class="h-24 rounded-lg border border-n-container bg-white/55 p-4 shadow-sm backdrop-blur dark:bg-white/[0.04]"
            >
              <div class="h-3 w-16 rounded-full bg-n-teal-9" />
              <div class="mt-3 h-3 w-24 rounded-full bg-n-alpha-2" />
            </div>
            <div
              class="h-24 rounded-lg border border-n-container bg-white/55 p-4 shadow-sm backdrop-blur dark:bg-white/[0.04]"
            >
              <div
                class="h-full rounded-md bg-gradient-to-br from-n-brand to-n-amber-9"
              />
            </div>
          </div>
        </div>
        <p class="text-xs font-medium text-n-slate-10">
          {{ replaceInstallationName($t('LOGIN.TITLE')) }}
        </p>
      </div>

      <div
        v-if="!email"
        class="flex items-center justify-center px-4 py-8 sm:px-8 lg:bg-white/45 lg:backdrop-blur-xl lg:dark:bg-black/20"
      >
        <div
          class="w-full max-w-md rounded-lg border border-n-container bg-white/90 p-8 shadow-2xl shadow-black/10 backdrop-blur dark:bg-n-solid-1/90 dark:shadow-black/40 sm:p-10"
        >
          <div class="mb-8">
            <h2 class="text-2xl font-semibold text-n-slate-12">
              {{ replaceInstallationName($t('LOGIN.TITLE')) }}
            </h2>
            <p v-if="showSignupLink" class="mt-2 text-sm text-n-slate-11">
              {{ $t('COMMON.OR') }}
              <router-link
                to="auth/signup"
                class="lowercase text-link text-n-brand"
              >
                {{ $t('LOGIN.CREATE_NEW_ACCOUNT') }}
              </router-link>
            </p>
          </div>
          <div class="flex flex-col gap-4">
            <GoogleOAuthButton v-if="showGoogleOAuth" />
            <div v-if="showSamlLogin" class="text-center">
              <router-link
                to="/app/login/sso"
                class="inline-flex justify-center w-full px-4 py-3 items-center bg-n-background dark:bg-n-solid-3 rounded-md shadow-sm ring-1 ring-inset ring-n-container dark:ring-n-container focus:outline-offset-0 hover:bg-n-alpha-2 dark:hover:bg-n-alpha-2"
              >
                <Icon
                  icon="i-lucide-lock-keyhole"
                  class="size-5 text-n-slate-11"
                />
                <span class="ml-2 text-base font-medium text-n-slate-12">
                  {{ $t('LOGIN.SAML.LABEL') }}
                </span>
              </router-link>
            </div>
            <SimpleDivider
              v-if="showGoogleOAuth || showSamlLogin"
              :label="$t('COMMON.OR')"
              class="uppercase"
            />
          </div>
          <form class="space-y-5" @submit.prevent="submitFormLogin">
            <FormInput
              v-model="credentials.email"
              name="email_address"
              type="text"
              data-testid="email_input"
              :tabindex="1"
              required
              :label="$t('LOGIN.EMAIL.LABEL')"
              :placeholder="$t('LOGIN.EMAIL.PLACEHOLDER')"
              :has-error="v$.credentials.email.$error"
              @input="v$.credentials.email.$touch"
            />
            <FormInput
              v-model="credentials.password"
              type="password"
              name="password"
              data-testid="password_input"
              required
              :tabindex="2"
              :label="$t('LOGIN.PASSWORD.LABEL')"
              :placeholder="$t('LOGIN.PASSWORD.PLACEHOLDER')"
              :has-error="v$.credentials.password.$error"
              @input="v$.credentials.password.$touch"
            >
              <p v-if="!globalConfig.disableUserProfileUpdate">
                <router-link
                  to="auth/reset/password"
                  class="text-sm text-link"
                  tabindex="4"
                >
                  {{ $t('LOGIN.FORGOT_PASSWORD') }}
                </router-link>
              </p>
            </FormInput>
            <NextButton
              lg
              type="submit"
              data-testid="submit_button"
              class="w-full"
              :tabindex="3"
              :label="$t('LOGIN.SUBMIT')"
              :disabled="loginApi.showLoading"
              :is-loading="loginApi.showLoading"
            />
          </form>
        </div>
      </div>
      <div v-else class="flex items-center justify-center">
        <Spinner color-scheme="primary" size="" />
      </div>
    </section>
  </main>
</template>

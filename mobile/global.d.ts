declare const process: {
  env: {
    EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    EXPO_PUBLIC_FACEBOOK_APP_ID?: string;
    EXPO_PUBLIC_TENANT_ID?: string;
    [key: string]: string | undefined;
  };
};

import { useEffect, useState } from "react";
import { createValueContainer, useValue } from "react-nano-state";
import { sentryException } from "~/shared/sentry";
import * as config from "./config";

type Name = keyof typeof config;
type Value = typeof config[Name]["values"][number];
type Settings = Record<Name, Value>;

const defaultSettings = (Object.keys(config) as Array<Name>).reduce(
  (acc, settingName) => {
    acc[settingName] = config[settingName].defaultValue;
    return acc;
  },
  {} as Settings
);

const namespace = "__webstudio_user_settings__";

const read = (): Settings => {
  let settingsString;
  try {
    settingsString = localStorage.getItem(namespace);
  } catch (_error) {
    // We don't need to handle this one.
  }

  if (settingsString == null) return defaultSettings;

  try {
    // @todo add zod schema
    return JSON.parse(settingsString);
  } catch (error) {
    if (error instanceof Error) {
      sentryException({
        message: "Bad user settings in local storage",
        extras: {
          error: error.message,
        },
      });
    }
  }
  return defaultSettings;
};

const write = (settings: Settings) => {
  localStorage.setItem(namespace, JSON.stringify(settings));
};

/**
 * Get a value from local storage or a default.
 */
export const getSetting = (name: Name) => {
  const settings = read();
  const validValues = config[name].values;
  const value = settings[name];
  const isValidValue = value !== undefined && validValues.includes(value);
  if (isValidValue) return value;
  return config[name].defaultValue;
};

export const setSetting = (name: Name, value: Value) => {
  const settings = read();
  const validValues = config[name].values;
  const isValidValue = validValues.includes(value);
  if (isValidValue) write({ ...settings, [name]: value });
};

const settingsContainer = createValueContainer<Settings>(defaultSettings);

export const useClientSettings = (): [Settings, typeof setSetting, boolean] => {
  const [settings, setSettings] = useValue(settingsContainer);
  // We need to know if the settings were loaded from local storage.
  // E.g. to decide if we should wait till the actual setting is loaded or use the default.
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSettings(read());
    setIsLoaded(true);
  }, [setSettings]);

  const setSettingValue = (name: Name, value: Value) => {
    if (settings[name] === value) return;
    setSettings({ ...settings, [name]: value });
    setSetting(name, value);
  };
  return [settings, setSettingValue, isLoaded];
};

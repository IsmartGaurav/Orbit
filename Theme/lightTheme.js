import { DefaultTheme } from "@react-navigation/native";
import { Dimensions } from "react-native";

const width = Dimensions.get("window").width;

export const lightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6CC04A',
    text: '#1A1A1A',
    textSecondary: '#555555',
    white: "white",
    spacing: 10,
    headingSize: width * 0.085,
    fontSize: width * 0.045,
    disabled: 'rgb(180,180,180)',
    background: '#F4F5FC',
    card: '#FFFFFF',
    border: '#E1E1E1',
    notification: '#6CC04A',
    cardSurface: '#ECECEC',
    settingsButtonBg: '#ECECEC',
    dropdownBg: '#FFFFFF',
    dropdownText: '#1A1A1A',
    icon: '#1A1A1A',
    subtitle: '#555555',
    buttonText: '#1A1A1A',
    placeholder: '#999999',
    searchBar: '#ECECEC',
    modalBackground: '#FFFFFF',
    headerBackground: '#F4F5FC',
    tabBarBackground: '#FFFFFF',
    tabBarActive: '#6CC04A',
    tabBarInactive: '#999999',
    musicPlayerBg: '#FFFFFF',
    playerControlsBg: '#F4F5FC',
  },
};

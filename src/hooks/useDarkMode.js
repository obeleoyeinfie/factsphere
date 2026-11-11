import { useEffect, useState } from "react";

function getInitialMode() {
  try {
    return localStorage.getItem("factsphere:theme") === "dark";
  } catch (error) {
    console.error("Could not read the saved theme preference.", error);
    return false;
  }
}

export default function useDarkMode() {
  const [darkMode, setDarkMode] = useState(getInitialMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      localStorage.setItem("factsphere:theme", darkMode ? "dark" : "light");
    } catch (error) {
      console.error("Could not save the theme preference.", error);
    }
  }, [darkMode]);

  return [darkMode, setDarkMode];
}

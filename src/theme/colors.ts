export const colors = {
  light: {
    background: "#F6F6FB",
    surface: "#FFFFFF",
    text: "#14142B",
    textMuted: "#67678A",
    primary: "#4F46E5",
    primaryText: "#FFFFFF", // texto/icono sobre el primary
    border: "#E8E8F1",
    track: "#EDEDF6",        // fondo de las barras de progreso
    success: "#16A34A",      // ingresos
    danger: "#E11D48",       // gastos / presupuesto pasado
    warning: "#D97706",      // presupuesto casi al límite
  },
  dark: {
    background: "#0C0C15",
    surface: "#16161F",
    text: "#F3F3FA",
    textMuted: "#9A9AB6",
    primary: "#818CF8",
    primaryText: "#10102A",
    border: "#242432",
    track: "#1C1C28",
    success: "#4ADE80",
    danger: "#FB7185",
    warning: "#FBBF24",
  },
} as const;

export type ColorScheme = keyof typeof colors;  
export type ColorToken = keyof typeof colors.light; 
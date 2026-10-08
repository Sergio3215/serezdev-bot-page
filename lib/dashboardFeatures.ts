export type DashboardCategoryId = "management" | "automation";

/** Coincide con el `state` que `ManageSettings` usa para elegir qué feature mostrar. */
export type DashboardFeatureId = "birthday" | "joinServer" | "gif" | "channelRule" | "scheduledTask" | "customCommand" | "autoCleanMessage" | "ghostMessage";

export interface DashboardCategory {
    id: DashboardCategoryId;
    label: string;
    description: string;
}

export interface DashboardFeature {
    id: DashboardFeatureId;
    category: DashboardCategoryId;
    /** Título de la tarjeta en el dashboard. */
    label: string;
    /** Título del encabezado al abrir la feature. */
    title: string;
}

export const DASHBOARD_CATEGORIES: DashboardCategory[] = [
    {
        id: "management",
        label: "Gestión",
        description: "Configuración y comportamiento general del bot en tu servidor.",
    },
    {
        id: "automation",
        label: "Automatización",
        description: "Acciones que se ejecutan solas según un comando o un horario.",
    },
];

export const DASHBOARD_FEATURES: DashboardFeature[] = [
    { id: "birthday", category: "management", label: "Recordatorio de cumpleaños", title: "Administrá el Recordatorio" },
    { id: "joinServer", category: "management", label: "Bienvenida al servidor", title: "Administrá la Bienvenida" },
    { id: "gif", category: "management", label: "Interacciones", title: "Administrador de Interacciones" },
    { id: "channelRule", category: "management", label: "Reglas de canal", title: "Reglas de canal" },
    { id: "scheduledTask", category: "automation", label: "Tareas programadas", title: "Tareas programadas" },
    { id: "customCommand", category: "automation", label: "Comandos personalizados", title: "Comandos Personalizados" },
    { id: "autoCleanMessage", category: "automation", label: "Limpieza automática", title: "Limpieza automática" },
    { id: "ghostMessage", category: "automation", label: "Mensajes fantasma", title: "Mensajes fantasma" },
];

export function featuresOf(category: DashboardCategoryId): DashboardFeature[] {
    return DASHBOARD_FEATURES.filter((feature) => feature.category === category);
}

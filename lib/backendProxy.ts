export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Endpoints del backend que el panel puede usar. El resto (sync, suscripciones, borrados masivos) no se expone. */
const ALLOWED_ENDPOINTS: Record<string, readonly Method[]> = {
    "gif/getInteractions": ["GET"],
    "gif/getInteractionByName": ["GET"],
    "gif/addGif": ["POST"],
    "gif/editGif": ["PUT"],
    "gif/deleteGif": ["DELETE"],
    "birthday/setup": ["GET", "PUT"],
    "birthday/setup-card": ["GET", "POST", "PUT"],
    "joinServer/setup": ["GET", "POST", "PUT"],
    "joinServer/setup-card": ["GET", "POST", "PUT"],
    "customCommand": ["GET", "POST"],
    "customCommand/preview": ["POST"],
    "customCommand/:id": ["PUT", "DELETE"],
    "customCommand/:id/status": ["PATCH"],
    "channelRule": ["GET", "POST"],
    "channelRule/:id": ["PUT", "DELETE"],
    "channelRule/:id/enabled": ["PATCH"],
    "scheduledTask": ["GET", "POST"],
    "scheduledTask/:id": ["PUT", "DELETE"],
    "scheduledTask/:id/status": ["PATCH"],
};

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;

/** Convierte `customCommand/<objectId>/status` en la clave `customCommand/:id/status`. */
export function endpointKey(path: string[]): string {
    return path.map((segment, index) => (index > 0 && OBJECT_ID_PATTERN.test(segment) ? ":id" : segment)).join("/");
}

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export function isAllowedEndpoint(path: string[], method: Method): boolean {
    return ALLOWED_ENDPOINTS[endpointKey(path)]?.includes(method) ?? false;
}

export function isSnowflake(value: string): boolean {
    return SNOWFLAKE_PATTERN.test(value);
}

/** Recursos con límite por plan: endpoint del backend, límite en PLAN_LIMITS y textos. */
export const LIMITED_RESOURCES = {
    customCommand: { limit: "customCommands", total: "comandos personalizados", active: "comandos activos", toggle: "status" },
    channelRule: { limit: "channelRules", total: "reglas de canal", active: "reglas activas", toggle: "enabled" },
} as const;

export type LimitedResource = keyof typeof LIMITED_RESOURCES;

/** Qué controla el límite del plan para este pedido: crear o activar un recurso limitado. */
export function limitCheckFor(method: Method, path: string[], body: string | undefined) {
    const [resource, id, toggle] = path;
    if (!(resource in LIMITED_RESOURCES)) return null;
    const config = LIMITED_RESOURCES[resource as LimitedResource];
    const enabling = JSON.parse(body ?? "{}").enabled === true;
    if (method === "POST" && path.length === 1) return { resource: resource as LimitedResource, action: "create" as const };
    if (method === "PATCH" && toggle === config.toggle && enabling) return { resource: resource as LimitedResource, action: "activate" as const, id };
    if (method === "PUT" && path.length === 2 && enabling) return { resource: resource as LimitedResource, action: "activate" as const, id };
    return null;
}

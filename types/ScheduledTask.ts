export type ScheduleType = "daily" | "weekly";

/** 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduledTask {
    id: string;
    serverId: string;
    name: string;
    channelId: string;
    content: string;
    scheduleType: ScheduleType;
    time: string;
    weekdays: number[];
    timezone: string;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Estado editable del formulario. */
export interface ScheduledTaskDraft {
    id: string | null;
    name: string;
    channelId: string;
    content: string;
    scheduleType: ScheduleType;
    time: string;
    weekdays: number[];
    timezone: string;
    enabled: boolean;
}

export interface ScheduledTaskPayload {
    name: string;
    channelId: string;
    content: string;
    scheduleType: ScheduleType;
    time: string;
    weekdays: number[];
    timezone: string;
    enabled?: boolean;
}

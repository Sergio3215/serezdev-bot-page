import React from "react";

export interface SectionsType {
    title: string;
    children: React.ReactNode;
}

export interface ContainerProps {
    children?: React.ReactNode;
    site?: string;
}

export interface ManageSettingType {
    state: string;
    setState: (value: string) => void;
    title: string;
}

export interface GifDataType {
    id: string;
    order: number;
    serverId: string;
    url: string;
    interactionId: string;
}

export interface InteractionDataType {
    id: string;
    name: string;
    gifs: GifDataType[];
}

export interface InteractionName {
    id: string;
    name: string;
}

export interface ButtonDiscordType {
    title: string;
    onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
}

export interface interactionManage {
    newFlag: boolean;
    setNewFlag: (value: boolean) => void;
}

export interface addGifsType {
    idServer: string;
    interactions: InteractionName[];
    goBack: () => void;
    defaultInteraction?: string;
}

export interface gifButtons {
    gifsItem: GifDataType;
    gifsArray: InteractionDataType;
    index: number;
}

export interface birthdayType {
    id: string
    serverId: string
    serverName: string;
    channelId: string;
    message: string;
}
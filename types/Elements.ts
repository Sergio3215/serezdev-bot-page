
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
    setState: any;
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
    onClick: any;
}

export interface interactionManage {
    newFlag: Boolean;
    setNewFlag: any;
}

export interface addGifsType {
    idServer: string;
    interactions: InteractionName[];
    goBack: any;
}
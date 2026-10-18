export type NoticeOrigin={message:string;scope?:string};
/** A success receipt belongs to the card that produced it. Global errors remain. */
export function noticePresentation(message:string,scope:string|undefined,previous?:NoticeOrigin){
 const origin=previous?.message===message?previous:{message,scope},selection=message.startsWith('已填入');
 return {origin,selection,visible:!selection||origin.scope===scope};
}

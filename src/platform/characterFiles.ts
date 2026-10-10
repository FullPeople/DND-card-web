import type {Character} from '../core/model';
import {readCharacterTransfer} from '../core/transfers';

export interface CharacterFiles {cards: Character[]; excelIds: string[]}
/** Validate every selected file before staging an import or creating any card. */
export async function readCharacterFiles(files: File[]): Promise<CharacterFiles> {
  if (!files.length) throw Error('请选择角色文件');
  if (files.length > 200) throw Error('一次最多导入 200 张角色卡');
  for (const file of files) {
    if (file.size > 20_000_000) throw Error('单个文件不能超过 20 MB');
    if (!/\.(json|xlsx)$/i.test(file.name)) throw Error('请选择 JSON 或旧版角色模板的 .xlsx 文件；不支持 .xls');
  }
  const cards: Character[] = [], excelIds: string[] = [];
  for (const file of files) {
    if (/\.xlsx$/i.test(file.name)) {
      const {readXlsxCharacter} = await import('./xlsxCharacter');
      const card = await readXlsxCharacter(file); cards.push(card); excelIds.push(card.id);
    } else cards.push(...readCharacterTransfer([await file.text()]));
    if (cards.length > 200) throw Error('一次最多导入 200 张角色卡');
  }
  return {cards, excelIds};
}

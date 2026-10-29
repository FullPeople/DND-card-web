import {expect,type Locator} from '@playwright/test';

/** Preparation checks supplement the original five-case acceptance contract. */
export async function waitForLinguistDraftReady(control:Locator,values:readonly string[],labels:{manualLabel:string;dmLabel:string;requiresDm:boolean}){
 for(const [index,reference] of values.entries())await expect(control.getByLabel(`语言学家语言 ${index+1}`,{exact:true})).toHaveValue(reference);
 await expect(control.getByRole('checkbox',{name:labels.manualLabel,exact:true})).not.toBeChecked();
 if(labels.requiresDm)await expect(control.getByRole('checkbox',{name:labels.dmLabel,exact:true})).not.toBeChecked();
 await expect(control.getByRole('button',{name:'确认语言学家',exact:true})).toBeDisabled();
 await expect(control.getByTestId('linguist-save-status')).toContainText('已保存到本机');
}

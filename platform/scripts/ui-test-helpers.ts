import type { Page } from '@playwright/test';
export async function switchPreviewRole(page:Page, as:'admin'|'member'){
 if(await page.locator('.sidebar.open').count()) await page.getByRole('button',{name:'Close navigation panel',exact:true}).click();
 await page.getByRole('button',{name:'Account menu',exact:true}).click();
 await page.getByRole('menuitem',{name:new RegExp('Preview as '+as)}).click();
}

export async function openProfile(page:Page){
 if(await page.locator('.sidebar.open').count()) await page.getByRole('button',{name:'Close navigation panel',exact:true}).click();
 await page.getByRole('button',{name:'Account menu',exact:true}).click();
 await page.getByRole('menuitem',{name:'Your profile',exact:true}).click();
}

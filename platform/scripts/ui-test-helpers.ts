import type { Page } from '@playwright/test';
export async function switchPreviewRole(page:Page, as:'admin'|'member'|'instructor'){
 if(await page.locator('.sidebar.open').count()) await page.getByRole('button',{name:'Close navigation panel',exact:true}).click();
 await page.getByRole('button',{name:'Account menu',exact:true}).click();
 await page.getByRole('menuitem',{name:new RegExp('Preview as '+as)}).click();
}

export async function openProfile(page:Page){
 if(await page.locator('.sidebar.open').count()) await page.getByRole('button',{name:'Close navigation panel',exact:true}).click();
 await page.getByRole('button',{name:'Account menu',exact:true}).click();
 await page.getByRole('menuitem',{name:'Your profile',exact:true}).click();
}

/**
 * Answers the app's own confirmation box (decision 055) whenever it opens before a later action or assertion. It confirms
 * unless `confirm()` returns false at that moment.
 */
export async function answerConfirmations(page:Page, confirm:()=>boolean=()=>true){
 const box=page.getByRole('alertdialog');
 await page.addLocatorHandler(box, async found => { await found.locator('[data-slot=alert-dialog-footer] button').nth(confirm()?1:0).click(); });
 /** Stops answering, for a check that looks at the box itself. */
 return () => page.removeLocatorHandler(box);
}

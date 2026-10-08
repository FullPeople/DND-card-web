import type {Character} from '../core/model';
import {PlayerSheet} from '../ui/PlayerViewer';
import {UiLanguageProvider} from '../ui/UiLanguage';
import {SourceProvider} from '../ui/SourceName';
import '../ui/style.css';
import '../ui/characterTabs.css';
import '../ui/workspace.css';
import '../ui/overview.css';
import '../ui/library.css';
import '../ui/cardAtmosphere.css';
import '../ui/libraryRefine.css';
import '../ui/characterPages.css';
import '../ui/suiteTheme.css';
import '../ui/responsive176.css';
import '../ui/refinement183.css';
import '../ui/domesticCompact.css';
import '../ui/screenLayout.css';
import './gallerySheet.css';

export default function SheetPreview({character,active}:{character:Character;active:boolean}){
 return <UiLanguageProvider><SourceProvider><PlayerSheet character={character} preview active={active}/></SourceProvider></UiLanguageProvider>;
}

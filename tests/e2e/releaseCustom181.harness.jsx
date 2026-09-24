import React from 'react';
import {createRoot} from 'react-dom/client';
import {CustomEntryEditor} from '../../src/ui/CustomEntryEditor';
import '../../src/ui/style.css';
document.body.style.cssText='height:auto;overflow:auto';
createRoot(document.getElementById('root')).render(<CustomEntryEditor busy={false} save={async()=>{}} remove={async()=>{}} newEntry={()=>{}}/>);

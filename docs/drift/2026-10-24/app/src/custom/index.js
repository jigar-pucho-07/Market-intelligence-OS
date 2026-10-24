// src/custom/index.js — the agent's 20%. Register custom sections/components by name; os.yaml refers to them via `custom: <Name>`.
// This file and this folder are never regenerated.
import MarketBrief from './MarketBrief';
import PipelineMap from './PipelineMap';
import PipelinePdf from './PipelinePdf';   // the Pipeline page's Export PDF section (os.yaml pipeline export.section)

export const CUSTOM = { MarketBrief, PipelineMap, PipelinePdf };

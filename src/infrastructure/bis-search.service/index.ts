import { readFileSync } from 'fs';
import { join } from 'path';

export interface BisSearchResult {
    bisContext: string;
    statPriority: string;
}

// Maps database (className, role) to the .md filename in ./data/
const SPEC_FILE_MAP: Record<string, Record<string, string>> = {
    warrior: { tank: 'warrior-tank', dps: 'warrior-dps' },
    paladin: { tank: 'paladin-tank', healer: 'paladin-healer', dps: 'paladin-dps' },
    hunter: { rdps: 'hunter-dps' },
    rogue: { dps: 'rogue-dps' },
    priest: { healer: 'priest-healer', dps: 'priest-dps', rdps: 'priest-dps' },
    shaman: { healer: 'shaman-healer', dps: 'shaman-dps', rdps: 'shaman-rdps' },
    mage: { dps: 'mage-dps', rdps: 'mage-dps.' },
    warlock: { dps: 'warlock-dps', rdps: 'warlock-dps' },
    druid: { tank: 'druid-tank', healer: 'druid-healer', dps: 'druid-mdps', mdps: 'druid-mdps', rdps: 'druid-rdps' },
};

export class BisSearchService {
    private readonly dataDir = join(__dirname, 'data');

    search(className: string, role: string, phase: number): BisSearchResult {
        const content = this.loadFile(className, role);
        if (!content) {
            return { bisContext: '', statPriority: '' };
        }

        const statPriority = this.extractSection(content, '## Stat Priority');
        const bisContext = this.extractBisSections(content, phase);

        return { bisContext, statPriority };
    }

    private loadFile(className: string, role: string): string | null {
        const classLower = className.toLowerCase();
        const roleLower = role.toLowerCase();
        const fileMap = SPEC_FILE_MAP[classLower];
        if (!fileMap) return null;

        const fileName = fileMap[roleLower];
        if (!fileName) return null;

        try {
            return readFileSync(join(this.dataDir, `${fileName}.md`), 'utf-8');
        } catch {
            console.warn(`BIS data file not found: ${fileName}.md`);
            return null;
        }
    }

    private extractSection(content: string, heading: string): string {
        const idx = content.indexOf(heading);
        if (idx === -1) return '';

        const afterHeading = content.slice(idx + heading.length);
        // Take everything until the next ## heading
        const nextHeading = afterHeading.indexOf('\n## ');
        const section = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
        return section.trim();
    }

    private extractBisSections(content: string, phase: number): string {
        const lines = content.split('\n');
        const bisLines: string[] = [];
        let inBis = false;

        for (const line of lines) {
            if (line.startsWith(`## Phase ${phase}`)) {
                inBis = true;
                bisLines.push(line);
            } else if (line.startsWith('## ') && inBis) {
                // Hit a non-phase heading, stop
                break;
            } else if (inBis) {
                bisLines.push(line);
            }
        }

        return bisLines.join('\n').trim();
    }
}

import { useState, useMemo } from 'react';
import { Calculator, HardDrive, DollarSign, Zap, Shield, Activity, AlertTriangle, Download, Share2, Sun, Moon, Plus, Trash2 } from 'lucide-react';

interface Drive {
  id: string;
  capacity: number; // in TB
}

interface RAIDConfig {
  level: string;
  minDrives: number;
  minGroupSize?: number;
  requiresEvenDrives?: boolean;
  requiresDivisibleGroups?: boolean;
  usableFormula: (drives: Drive[], hotSpares: number, groupSize?: number) => number;
  parityDrives: (totalDrives: number, groupSize?: number) => number;
  failureTolerance: (totalDrives: number, groupSize?: number) => number;
  description: string;
  performance: string;
  redundancy: string;
  useCase: string;
}

interface NASPreset {
  name: string;
  brand: string;
  bays: number;
  defaultDriveSize: number;
}

const nasPresets: NASPreset[] = [
  { name: 'DS923+', brand: 'Synology', bays: 4, defaultDriveSize: 4 },
  { name: 'DS1522+', brand: 'Synology', bays: 5, defaultDriveSize: 8 },
  { name: 'DS1821+', brand: 'Synology', bays: 8, defaultDriveSize: 8 },
  { name: 'DS2422+', brand: 'Synology', bays: 12, defaultDriveSize: 12 },
  { name: 'TS-464', brand: 'QNAP', bays: 4, defaultDriveSize: 4 },
  { name: 'TS-873A', brand: 'QNAP', bays: 8, defaultDriveSize: 8 },
  { name: 'TS-1277', brand: 'QNAP', bays: 12, defaultDriveSize: 12 },
  { name: 'Custom 2-Bay', brand: 'Custom', bays: 2, defaultDriveSize: 4 },
  { name: 'Custom 6-Bay', brand: 'Custom', bays: 6, defaultDriveSize: 6 },
  { name: 'Custom 24-Bay', brand: 'Custom', bays: 24, defaultDriveSize: 16 },
];

const raidConfigs: Record<string, RAIDConfig> = {
  '0': {
    level: '0',
    minDrives: 2,
    usableFormula: (drives) => drives.reduce((sum, d) => sum + d.capacity, 0),
    parityDrives: () => 0,
    failureTolerance: () => 0,
    description: 'Striping across all drives - No redundancy, maximum performance and capacity',
    performance: 'Excellent',
    redundancy: 'None',
    useCase: 'Non-critical data, maximum speed needed'
  },
  '1': {
    level: '1',
    minDrives: 2,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return Math.floor(activeDrives / 2) * minSize;
    },
    parityDrives: (total) => Math.floor(total / 2),
    failureTolerance: () => 1,
    description: 'Complete mirroring - 50% capacity, excellent redundancy for 2-4 drives',
    performance: 'Good',
    redundancy: 'High',
    useCase: 'Critical data, 2-4 drives, read-heavy workloads'
  },
  '1E': {
    level: '1E',
    minDrives: 3,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return Math.floor(activeDrives / 2) * minSize;
    },
    parityDrives: (total) => Math.floor(total / 2),
    failureTolerance: () => 1,
    description: 'Enhanced mirroring - Supports odd number of drives, distributed mirrors',
    performance: 'Good',
    redundancy: 'High',
    useCase: 'Odd-numbered drive arrays, better rebuild performance than RAID 1'
  },
  '10': {
    level: '10',
    minDrives: 4,
    requiresEvenDrives: true,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return (activeDrives / 2) * minSize;
    },
    parityDrives: (total) => total / 2,
    failureTolerance: () => 1,
    description: 'Mirrored stripes - Excellent performance and redundancy, requires even drives',
    performance: 'Excellent',
    redundancy: 'High',
    useCase: 'Database servers, high I/O applications, 4+ even drives'
  },
  '5': {
    level: '5',
    minDrives: 3,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return (activeDrives - 1) * minSize;
    },
    parityDrives: () => 1,
    failureTolerance: () => 1,
    description: 'Single parity striping - Good balance of capacity, performance, and redundancy',
    performance: 'Good',
    redundancy: 'Medium',
    useCase: 'General purpose, 3-8 drives, balanced workloads'
  },
  '6': {
    level: '6',
    minDrives: 4,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return (activeDrives - 2) * minSize;
    },
    parityDrives: () => 2,
    failureTolerance: () => 2,
    description: 'Dual parity striping - Can survive 2 drive failures, safer for large drives',
    performance: 'Good',
    redundancy: 'High',
    useCase: 'Large capacity drives (>8TB), mission-critical data, 4+ drives'
  },
  '5E': {
    level: '5E',
    minDrives: 4,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return (activeDrives - 2) * minSize;
    },
    parityDrives: () => 2,
    failureTolerance: () => 1,
    description: 'RAID 5 with integrated distributed spare - Faster rebuild than hot spare',
    performance: 'Good',
    redundancy: 'Medium-High',
    useCase: 'When faster rebuild is priority over RAID 5'
  },
  '5EE': {
    level: '5EE',
    minDrives: 4,
    usableFormula: (drives, hotSpares) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      return (activeDrives - 2) * minSize;
    },
    parityDrives: () => 2,
    failureTolerance: () => 1,
    description: 'Enhanced RAID 5E - Better spare distribution and performance',
    performance: 'Good',
    redundancy: 'Medium-High',
    useCase: 'Advanced RAID 5E alternative with better characteristics'
  },
  '50': {
    level: '50',
    minDrives: 6,
    minGroupSize: 3,
    requiresDivisibleGroups: true,
    usableFormula: (drives, hotSpares, groupSize = 3) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      const groups = activeDrives / groupSize;
      return groups * (groupSize - 1) * minSize;
    },
    parityDrives: (total, groupSize = 3) => total / groupSize,
    failureTolerance: (total, groupSize = 3) => Math.floor(total / groupSize),
    description: 'Striped RAID 5 arrays - Better performance, 1 failure per RAID 5 group',
    performance: 'Excellent',
    redundancy: 'Medium',
    useCase: 'Large arrays (6-24 drives), high performance needs'
  },
  '60': {
    level: '60',
    minDrives: 8,
    minGroupSize: 4,
    requiresDivisibleGroups: true,
    usableFormula: (drives, hotSpares, groupSize = 4) => {
      const minSize = Math.min(...drives.map(d => d.capacity));
      const activeDrives = drives.length - hotSpares;
      const groups = activeDrives / groupSize;
      return groups * (groupSize - 2) * minSize;
    },
    parityDrives: (total, groupSize = 4) => (total / groupSize) * 2,
    failureTolerance: (total, groupSize = 4) => Math.floor(total / groupSize) * 2,
    description: 'Striped RAID 6 arrays - Maximum redundancy, 2 failures per RAID 6 group',
    performance: 'Very Good',
    redundancy: 'Very High',
    useCase: 'Enterprise, very large arrays, maximum data protection'
  }
};

export default function RaidCalculator() {
  const [darkMode, setDarkMode] = useState(false);
  const [raidLevel, setRaidLevel] = useState('5');
  const [drives, setDrives] = useState<Drive[]>([
    { id: '1', capacity: 4 },
    { id: '2', capacity: 4 },
    { id: '3', capacity: 4 },
    { id: '4', capacity: 4 }
  ]);
  const [hotSpares, setHotSpares] = useState(0);
  const [groupSize, setGroupSize] = useState(3);
  const [drivePrice, setDrivePrice] = useState(100);
  const [rebuildSpeed, setRebuildSpeed] = useState(100); // MB/s
  const [ureRate, setUreRate] = useState(1e-14);
  const [afrRate, setAfrRate] = useState(0.5); // Annual Failure Rate %
  const [powerPerDrive, setPowerPerDrive] = useState(5); // Watts

  const config = raidConfigs[raidLevel];

  // Calculate results
  const results = useMemo(() => {
    const minSize = Math.min(...drives.map(d => d.capacity));
    const maxSize = Math.max(...drives.map(d => d.capacity));
    const totalRaw = drives.reduce((sum, d) => sum + d.capacity, 0);
    const mixedSizes = minSize !== maxSize;
    
    const activeDrives = drives.length - hotSpares;
    const usable = config.usableFormula(drives, hotSpares, groupSize);
    const parity = totalRaw - usable - (hotSpares * minSize);
    const efficiency = (usable / totalRaw) * 100;
    
    const failureTolerance = config.failureTolerance(activeDrives, groupSize);
    
    // Cost calculations
    const totalCost = drives.length * drivePrice;
    const costPerTB = totalCost / usable;
    
    // Rebuild time (hours)
    const rebuildDataTB = minSize;
    const rebuildHours = (rebuildDataTB * 1024 * 1024) / (rebuildSpeed * 3600);
    
    // URE probability during rebuild
    const bitsToRead = rebuildDataTB * 8 * Math.pow(2, 40);
    const ureProb = 1 - Math.pow(1 - ureRate, bitsToRead);
    
    // Approximate annual data loss probability (simplified)
    const adlProb = (afrRate / 100) * (activeDrives - failureTolerance) * (rebuildHours / 8760);
    
    // Power & Heat
    const totalPowerWatts = drives.length * powerPerDrive;
    const totalPowerKWh = (totalPowerWatts / 1000) * 24 * 365; // Annual
    const heatBTU = totalPowerWatts * 3.412;
    
    return {
      minSize,
      maxSize,
      mixedSizes,
      totalRaw,
      usable,
      parity,
      efficiency,
      failureTolerance,
      totalCost,
      costPerTB,
      rebuildHours,
      ureProb,
      adlProb,
      totalPowerWatts,
      totalPowerKWh,
      heatBTU,
      activeDrives
    };
  }, [drives, hotSpares, raidLevel, groupSize, drivePrice, rebuildSpeed, ureRate, afrRate, powerPerDrive, config]);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (drives.length < config.minDrives) {
      errors.push(`RAID ${raidLevel} requires minimum ${config.minDrives} drives`);
    }
    
    if (config.requiresEvenDrives && drives.length % 2 !== 0) {
      errors.push(`RAID ${raidLevel} requires an even number of drives`);
    }
    
    if (config.requiresDivisibleGroups && drives.length % groupSize !== 0) {
      errors.push(`Total drives must be divisible by group size (${groupSize})`);
    }
    
    if (results.mixedSizes) {
      warnings.push(`Mixed drive sizes detected. Usable capacity calculated using minimum drive size (${results.minSize} TB)`);
    }
    
    if (results.ureProb > 0.01) {
      warnings.push(`High URE risk during rebuild (${(results.ureProb * 100).toFixed(2)}%). Consider RAID 6 or smaller drives.`);
    }
    
    if (raidLevel === '5' && results.minSize > 8) {
      warnings.push(`RAID 5 with drives >8TB has increased rebuild risk. Consider RAID 6.`);
    }
    
    return { errors, warnings, isValid: errors.length === 0 };
  }, [drives, raidLevel, groupSize, config, results]);

  const addDrive = () => {
    const newId = (Math.max(...drives.map(d => parseInt(d.id)), 0) + 1).toString();
    setDrives([...drives, { id: newId, capacity: 4 }]);
  };

  const removeDrive = (id: string) => {
    if (drives.length > 2) {
      setDrives(drives.filter(d => d.id !== id));
    }
  };

  const updateDrive = (id: string, capacity: number) => {
    setDrives(drives.map(d => d.id === id ? { ...d, capacity } : d));
  };

  const loadPreset = (preset: NASPreset) => {
    const newDrives = Array.from({ length: preset.bays }, (_, i) => ({
      id: (i + 1).toString(),
      capacity: preset.defaultDriveSize
    }));
    setDrives(newDrives);
    setHotSpares(0);
  };

  const exportResults = () => {
    const data = {
      raidLevel,
      drives: drives.length,
      driveCapacity: results.minSize,
      hotSpares,
      usableCapacity: results.usable.toFixed(2),
      efficiency: results.efficiency.toFixed(1),
      failureTolerance: results.failureTolerance,
      totalCost: results.totalCost.toFixed(2),
      costPerTB: results.costPerTB.toFixed(2),
      rebuildTime: results.rebuildHours.toFixed(1),
      ureRisk: (results.ureProb * 100).toFixed(4)
    };
    
    const csv = Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raid-${raidLevel}-calculation.csv`;
    a.click();
  };

  const shareableLink = () => {
    const params = new URLSearchParams({
      raid: raidLevel,
      drives: drives.length.toString(),
      size: results.minSize.toString(),
      spares: hotSpares.toString()
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className={`w-full ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 transition-colors">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header with theme toggle */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Professional RAID Calculator</h1>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
          </div>

          {/* NAS Presets */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Presets</h3>
            <div className="flex flex-wrap gap-2">
              {nasPresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                >
                  {preset.brand} {preset.name} ({preset.bays}-bay)
                </button>
              ))}
            </div>
          </div>

          {/* Validation Messages */}
          {validation.errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              {validation.errors.map((error, i) => (
                <div key={i} className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              {validation.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{warning}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Configuration Panel */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">RAID Configuration</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">RAID Level</label>
                    <select
                      value={raidLevel}
                      onChange={(e) => setRaidLevel(e.target.value)}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(raidConfigs).map(([level, cfg]) => (
                        <option key={level} value={level}>
                          RAID {level} - {cfg.description.split('-')[0].trim()}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{config.description}</p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded">Performance: {config.performance}</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 rounded">Redundancy: {config.redundancy}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2"><strong>Use case:</strong> {config.useCase}</p>
                  </div>

                  {config.requiresDivisibleGroups && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Group Size</label>
                      <input
                        type="number"
                        min={config.minGroupSize}
                        value={groupSize}
                        onChange={(e) => setGroupSize(Number(e.target.value))}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Drives per RAID group (min: {config.minGroupSize})</p>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Drives ({drives.length})</label>
                      <button onClick={addDrive} className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <Plus className="w-3 h-3" /> Add Drive
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {drives.map((drive, index) => (
                        <div key={drive.id} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-8">#{index + 1}</span>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={drive.capacity}
                            onChange={(e) => updateDrive(drive.id, Number(e.target.value))}
                            className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">TB</span>
                          <button
                            onClick={() => removeDrive(drive.id)}
                            disabled={drives.length <= 2}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hot Spares</label>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(0, drives.length - config.minDrives)}
                      value={hotSpares}
                      onChange={(e) => setHotSpares(Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Dedicated spare drives for automatic rebuild</p>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cost & Performance</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Price per Drive ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={drivePrice}
                      onChange={(e) => setDrivePrice(Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Rebuild Speed (MB/s)</label>
                    <input
                      type="number"
                      min="10"
                      value={rebuildSpeed}
                      onChange={(e) => setRebuildSpeed(Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Power per Drive (Watts)</label>
                    <input
                      type="number"
                      min="1"
                      value={powerPerDrive}
                      onChange={(e) => setPowerPerDrive(Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Annual Failure Rate (%)</label>
                    <input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={afrRate}
                      onChange={(e) => setAfrRate(Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="space-y-6">
              {/* Capacity Results */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <HardDrive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  Storage Capacity
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Raw Capacity:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{results.totalRaw.toFixed(2)} TB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Parity/Mirror:</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{results.parity.toFixed(2)} TB</span>
                  </div>
                  {hotSpares > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Hot Spares:</span>
                      <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{(hotSpares * results.minSize).toFixed(2)} TB</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-gray-600">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Usable Capacity:</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">{results.usable.toFixed(2)} TB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Efficiency:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{results.efficiency.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="mt-4">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex">
                    <div 
                      className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold"
                      style={{ width: `${(results.usable / results.totalRaw) * 100}%` }}
                    >
                      {results.usable.toFixed(1)} TB
                    </div>
                    <div 
                      className="bg-orange-500 flex items-center justify-center text-white text-xs font-semibold"
                      style={{ width: `${(results.parity / results.totalRaw) * 100}%` }}
                    >
                      Parity
                    </div>
                    {hotSpares > 0 && (
                      <div 
                        className="bg-yellow-500 flex items-center justify-center text-white text-xs font-semibold"
                        style={{ width: `${((hotSpares * results.minSize) / results.totalRaw) * 100}%` }}
                      >
                        Spare
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost Analysis */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  Cost Analysis
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Total Cost:</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">${results.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Cost per Usable TB:</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">${results.costPerTB.toFixed(2)}/TB</span>
                  </div>
                </div>
              </div>

              {/* Reliability & Performance */}
              <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 rounded-xl p-6 border border-red-200 dark:border-red-800 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
                  Reliability & Risk
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Failure Tolerance:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{results.failureTolerance} drive(s)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Rebuild Time:</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{results.rebuildHours.toFixed(1)} hours</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">URE Risk (rebuild):</span>
                    <span className={`text-lg font-bold ${results.ureProb > 0.01 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(results.ureProb * 100).toFixed(4)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Annual Data Loss Risk:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{(results.adlProb * 100).toFixed(4)}%</span>
                  </div>
                </div>
              </div>

              {/* Power & Heat */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800 shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  Power & Heat
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Total Power Draw:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{results.totalPowerWatts} W</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Annual Energy:</span>
                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{results.totalPowerKWh.toFixed(0)} kWh/year</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Heat Output:</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{results.heatBTU.toFixed(0)} BTU/h</span>
                  </div>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={exportResults}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  <Download className="w-5 h-5" />
                  Export CSV
                </button>
                <button
                  onClick={shareableLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  <Share2 className="w-5 h-5" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
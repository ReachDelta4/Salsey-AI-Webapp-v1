import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGeminiChat, ModelSettings } from "@/hooks/useGeminiChat";

// Default settings
const defaultSettings: ModelSettings = {
  model: "gemini-2.5-flash-preview-05-20",
  thinkingMode: "off",
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
  stopSequences: [],
  safetySettings: {
    harassment: "block_medium_and_above",
    hateSpeech: "block_medium_and_above",
    sexuallyExplicit: "block_medium_and_above",
    dangerous: "block_medium_and_above"
  }
};

const ModelSettingsTab: React.FC = () => {
  const { modelSettings, updateModelSettings, reloadModelSettings, isClientAvailable } = useGeminiChat();
  const [settings, setSettings] = useState<ModelSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState("general");
  const [stopSequence, setStopSequence] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  // Load settings from the hook when available
  useEffect(() => {
    if (modelSettings) {
      setSettings(modelSettings);
    } else {
      // Try to reload settings if not available
      const loadedSettings = reloadModelSettings();
      if (loadedSettings) {
        setSettings(loadedSettings);
      }
    }
  }, [modelSettings, reloadModelSettings]);

  // Track changes to settings
  useEffect(() => {
    if (modelSettings) {
      setIsChanged(JSON.stringify(modelSettings) !== JSON.stringify(settings));
    } else {
      setIsChanged(JSON.stringify(defaultSettings) !== JSON.stringify(settings));
    }
  }, [settings, modelSettings]);

  const handleSaveSettings = () => {
    if (updateModelSettings) {
      updateModelSettings(settings);
      setIsSaved(true);
      setIsChanged(false);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleResetSettings = () => {
    setSettings(defaultSettings);
    setIsChanged(true);
  };

  const handleTestModel = async () => {
    try {
      // First save the current settings
      updateModelSettings(settings);
      
      // Create a simple test message
      const testMessage = `Testing model: ${settings.model}`;
      alert(`Testing model ${settings.model}...\nThis will take a moment.`);
      
      // Import the client directly for this test
      const GeminiClient = (await import('@/integrations/gemini/GeminiClient')).default;
      
      // Send a test message
      const response = await GeminiClient.sendStatelessMessage("Please respond with 'Hello from " + settings.model + "'");
      
      // Show the response
      alert(`Response from model:\n${response}`);
    } catch (error) {
      console.error("Error testing model:", error);
      alert(`Error testing model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addStopSequence = () => {
    if (stopSequence && !settings.stopSequences.includes(stopSequence)) {
      setSettings({
        ...settings,
        stopSequences: [...settings.stopSequences, stopSequence]
      });
      setStopSequence("");
    }
  };

  const removeStopSequence = (sequence: string) => {
    setSettings({
      ...settings,
      stopSequences: settings.stopSequences.filter(seq => seq !== sequence)
    });
  };

  if (!isClientAvailable) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-600">Gemini API Not Available</AlertTitle>
        <AlertDescription className="text-amber-600">
          The Gemini API client is not available. Please check your API key in the .env.local file.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gemini AI Model Settings</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleResetSettings}
            disabled={!isChanged}
          >
            Reset to Default
          </Button>
          <Button 
            onClick={handleSaveSettings}
            disabled={!isChanged}
          >
            Save Settings
          </Button>
        </div>
      </div>

      {isSaved && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Success</AlertTitle>
          <AlertDescription className="text-green-600">
            Your model settings have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="info">Information</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>
                Choose the Gemini model that best fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select 
                  value={settings.model} 
                  onValueChange={(value) => setSettings({...settings, model: value})}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.5-flash-preview-05-20">Gemini 2.5 Flash Preview 05-20</SelectItem>
                    <SelectItem value="gemini-2.5-pro-preview-03-25">Gemini 2.5 Pro Preview 03-25</SelectItem>
                    
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                    
                    <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro (Latest)</SelectItem>
                    <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Latest)</SelectItem>
                    <SelectItem value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  className="mt-2" 
                  variant="secondary" 
                  onClick={handleTestModel}
                >
                  Test Selected Model
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="thinking-mode">Thinking Mode</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Thinking mode enables the model to perform step-by-step reasoning before providing an answer.
                          Auto lets the model decide when to use thinking, On forces thinking for all prompts, and Off disables thinking.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select 
                  value={settings.thinkingMode} 
                  onValueChange={(value: "off" | "auto" | "on") => setSettings({...settings, thinkingMode: value})}
                >
                  <SelectTrigger id="thinking-mode">
                    <SelectValue placeholder="Select thinking mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="auto">Auto (Default)</SelectItem>
                    <SelectItem value="on">On</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature: {settings.temperature}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Controls randomness: Lower values are more deterministic (focused),
                          higher values are more random (creative). Range: 0.0 to 1.0
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[settings.temperature]}
                  onValueChange={(value) => setSettings({...settings, temperature: value[0]})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-tokens">Max Output Tokens: {settings.maxOutputTokens}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Maximum number of tokens to generate in the response.
                          A token is approximately 4 characters.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="max-tokens"
                  min={1}
                  max={8192}
                  step={1}
                  value={[settings.maxOutputTokens]}
                  onValueChange={(value) => setSettings({...settings, maxOutputTokens: value[0]})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Parameters</CardTitle>
              <CardDescription>
                Fine-tune the model's behavior with advanced settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="top-p">Top P: {settings.topP}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Nucleus sampling: Only consider tokens comprising the top P probability mass.
                          Lower values are more focused, higher values more diverse. Range: 0.0 to 1.0
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="top-p"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[settings.topP]}
                  onValueChange={(value) => setSettings({...settings, topP: value[0]})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="top-k">Top K: {settings.topK}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Only consider the top K tokens for each generation step.
                          Range: 1 to 100
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="top-k"
                  min={1}
                  max={100}
                  step={1}
                  value={[settings.topK]}
                  onValueChange={(value) => setSettings({...settings, topK: value[0]})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="stop-sequences">Stop Sequences</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The model will stop generating text when it encounters any of these sequences.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="stop-sequences"
                    value={stopSequence}
                    onChange={(e) => setStopSequence(e.target.value)}
                    placeholder="Enter a stop sequence"
                  />
                  <Button type="button" onClick={addStopSequence} variant="outline">
                    Add
                  </Button>
                </div>
                {settings.stopSequences.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {settings.stopSequences.map((seq, index) => (
                      <div key={index} className="bg-muted px-3 py-1 rounded-md flex items-center gap-2">
                        <span>{seq}</span>
                        <button
                          type="button"
                          onClick={() => removeStopSequence(seq)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety Settings</CardTitle>
              <CardDescription>
                Configure content filtering thresholds for different categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="harassment">Harassment</Label>
                <Select 
                  value={settings.safetySettings.harassment} 
                  onValueChange={(value) => setSettings({
                    ...settings, 
                    safetySettings: {...settings.safetySettings, harassment: value}
                  })}
                >
                  <SelectTrigger id="harassment">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block_none">Block None</SelectItem>
                    <SelectItem value="block_only_high">Block Only High</SelectItem>
                    <SelectItem value="block_medium_and_above">Block Medium and Above (Default)</SelectItem>
                    <SelectItem value="block_low_and_above">Block Low and Above</SelectItem>
                    <SelectItem value="harm_block_threshold_unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hate-speech">Hate Speech</Label>
                <Select 
                  value={settings.safetySettings.hateSpeech} 
                  onValueChange={(value) => setSettings({
                    ...settings, 
                    safetySettings: {...settings.safetySettings, hateSpeech: value}
                  })}
                >
                  <SelectTrigger id="hate-speech">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block_none">Block None</SelectItem>
                    <SelectItem value="block_only_high">Block Only High</SelectItem>
                    <SelectItem value="block_medium_and_above">Block Medium and Above (Default)</SelectItem>
                    <SelectItem value="block_low_and_above">Block Low and Above</SelectItem>
                    <SelectItem value="harm_block_threshold_unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sexually-explicit">Sexually Explicit</Label>
                <Select 
                  value={settings.safetySettings.sexuallyExplicit} 
                  onValueChange={(value) => setSettings({
                    ...settings, 
                    safetySettings: {...settings.safetySettings, sexuallyExplicit: value}
                  })}
                >
                  <SelectTrigger id="sexually-explicit">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block_none">Block None</SelectItem>
                    <SelectItem value="block_only_high">Block Only High</SelectItem>
                    <SelectItem value="block_medium_and_above">Block Medium and Above (Default)</SelectItem>
                    <SelectItem value="block_low_and_above">Block Low and Above</SelectItem>
                    <SelectItem value="harm_block_threshold_unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dangerous">Dangerous Content</Label>
                <Select 
                  value={settings.safetySettings.dangerous} 
                  onValueChange={(value) => setSettings({
                    ...settings, 
                    safetySettings: {...settings.safetySettings, dangerous: value}
                  })}
                >
                  <SelectTrigger id="dangerous">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block_none">Block None</SelectItem>
                    <SelectItem value="block_only_high">Block Only High</SelectItem>
                    <SelectItem value="block_medium_and_above">Block Medium and Above (Default)</SelectItem>
                    <SelectItem value="block_low_and_above">Block Low and Above</SelectItem>
                    <SelectItem value="harm_block_threshold_unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Information</CardTitle>
              <CardDescription>
                Learn about the available models and their capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Gemini 2.5 Series (Preview)</h3>
                <p className="text-muted-foreground">
                  The latest generation of models, offering the best performance and capabilities. These are preview models and may have limitations.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Gemini 2.5 Pro</div>
                  <div>State-of-the-art model for complex reasoning and coding.</div>
                  <div className="font-medium">Gemini 2.5 Flash</div>
                  <div>Fast and cost-efficient model for most tasks.</div>
                  <div className="font-medium">Knowledge Cutoff</div>
                  <div>August 2024</div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Gemini 2.0 Series</h3>
                <p className="text-muted-foreground">
                  Next-generation models with superior speed and a large context window.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Gemini 2.0 Flash</div>
                  <div>Fast, efficient model for real-time applications.</div>
                  <div className="font-medium">Gemini 2.0 Flash Lite</div>
                  <div>A more cost-efficient and low-latency version of Flash.</div>
                  <div className="font-medium">Knowledge Cutoff</div>
                  <div>August 2024</div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Gemini 1.5 Series</h3>
                <p className="text-muted-foreground">
                  A powerful and versatile series of models with a large context window and strong multimodal capabilities.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Gemini 1.5 Pro</div>
                  <div>Best for complex reasoning tasks.</div>
                  <div className="font-medium">Gemini 1.5 Flash</div>
                  <div>Balanced for performance and speed.</div>
                  <div className="font-medium">Gemini 1.5 Flash 8B</div>
                  <div>Efficient model for high-volume tasks.</div>
                  <div className="font-medium">Knowledge Cutoff</div>
                  <div>February 2024</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModelSettingsTab; 
# Creates 7 stacked onboarding PR branches from wip/onboarding-all-changes
$ErrorActionPreference = "Stop"
Set-Location "d:\ALwrity-prod"

$WIP = "wip/onboarding-all-changes"
$MAIN = "main"

function Checkout-WipFiles {
    param([string[]]$Files)
    foreach ($f in $Files) {
        git checkout $WIP -- $f 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Failed to checkout $f from $WIP" }
    }
}

$PR1_FILES = @(
    "backend/api/onboarding_utils/website_change_invalidation.py",
    "backend/api/onboarding_utils/step_management_service.py",
    "backend/api/onboarding_utils/platform_strategies/website_strategy.py",
    "backend/api/onboarding_utils/step4_persona_routes.py",
    "backend/services/validation.py",
    "backend/tests/services/onboarding/test_website_change_invalidation.py",
    "backend/tests/test_validation.py",
    "backend/tests/services/onboarding/test_step_renumber.py"
)

$PR2_FILES = @(
    "backend/api/onboarding_utils/website_analysis_latest_policy.py",
    "backend/services/website_analysis_service.py",
    "backend/tests/services/onboarding/test_website_analysis_latest_policy.py",
    "frontend/src/components/OnboardingWizard/WebsiteStep/utils/websiteAnalysisDisplay.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/utils/websiteAnalysisDisplay.test.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/utils/websiteUtils.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/utils/constants.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/WebsiteAnalysisTabContent.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/__tests__/WebsiteAnalysisTabContent.test.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/hooks/useWebsiteAnalysis.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/hooks/__tests__/useWebsiteAnalysis.test.tsx"
)

$PR3_FILES = @(
    "frontend/src/components/OnboardingWizard/common/onboardingSessionKey.ts",
    "frontend/src/components/OnboardingWizard/common/onboardingSessionKey.test.ts",
    "frontend/src/components/OnboardingWizard/common/onboardingStorageKeys.ts",
    "frontend/src/components/OnboardingWizard/common/onboardingStorageKeys.test.ts",
    "frontend/src/components/OnboardingWizard/common/wizardLiveWebsiteSession.ts",
    "frontend/src/components/OnboardingWizard/common/wizardLiveWebsiteSession.test.ts",
    "frontend/src/components/OnboardingWizard/PersonaStep/personaInitialization.ts",
    "frontend/src/components/OnboardingWizard/PersonaStep/personaGeneration.ts",
    "frontend/src/api/personaApi.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep.tsx"
)

$PR4_FILES = @(
    "frontend/src/components/OnboardingWizard/common/wizardStepNavigationGuard.ts",
    "frontend/src/components/OnboardingWizard/common/wizardStepNavigationGuard.test.ts",
    "frontend/src/components/OnboardingWizard/common/wizardStepValidation.ts",
    "frontend/src/components/OnboardingWizard/common/wizardStepValidation.test.ts",
    "frontend/src/components/OnboardingWizard/common/wizardStepValidation.bug.test.ts"
)

$PR5_FILES = @(
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/competitorResearchRestore.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/competitorResearchRestore.test.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/useCompetitorDiscovery.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/__tests__/useCompetitorDiscovery.test.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/competitorDiscoveryCache.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/competitorDiscoveryCache.test.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep.tsx",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/useCompetitorResearchWorkflow.ts",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/CompetitorAnalysisHeader.tsx",
    "frontend/src/components/OnboardingWizard/CompetitorAnalysisStep/competitorStepUiHelpers.tsx",
    "frontend/src/components/OnboardingWizard/Wizard/WizardStepContent.tsx"
)

$PR6_FILES = @(
    "frontend/src/components/OnboardingWizard/Wizard/WizardShell.tsx",
    "frontend/src/components/OnboardingWizard/Wizard/useWizardStepAdvance.ts",
    "frontend/src/components/OnboardingWizard/common/onboardingResumeMessage.ts",
    "frontend/src/components/OnboardingWizard/common/onboardingResumeMessage.test.ts",
    "frontend/src/components/OnboardingWizard/common/useOnboardingResumeToast.ts",
    "frontend/src/components/OnboardingWizard/common/useOnboardingResumeToast.test.ts",
    "frontend/src/components/OnboardingWizard/common/OnboardingResumeToast.tsx",
    "frontend/src/components/OnboardingWizard/common/OnboardingSuccessToast.tsx",
    "frontend/src/components/OnboardingWizard/common/WizardHeader.tsx",
    "frontend/src/components/OnboardingWizard/common/WizardStepper.tsx",
    "frontend/src/components/OnboardingWizard/common/__tests__/WizardStepper.test.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/websiteUrlAutofillStyles.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/websiteUrlAutofillStyles.test.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/websiteUrlActionBarStyles.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/WebsiteUrlActionBar.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/components/__tests__/WebsiteUrlActionBar.test.tsx",
    "frontend/src/components/OnboardingWizard/Wizard.tsx"
)

$PR7_FILES = @(
    "frontend/src/components/OnboardingWizard/WebsiteStep/BackgroundSetupCard/BackgroundSetupCard.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/BackgroundSetupCard/constants.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/BackgroundSetupCard/index.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/BackgroundSetupCard/useBackgroundSetupState.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/BackgroundSetupCard.tsx",
    "frontend/src/components/OnboardingWizard/WebsiteStep/backgroundSetupCache.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/backgroundSetupCache.test.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/backgroundSetupNavigation.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/backgroundSetupNavigation.test.ts",
    "frontend/src/components/OnboardingWizard/WebsiteStep/SeoPreviewCard.tsx",
    "frontend/src/components/OnboardingWizard/PersonalizationStep.tsx",
    "frontend/src/components/OnboardingWizard/PersonalizationStep/usePersonalizationStepController.ts",
    "frontend/src/components/OnboardingWizard/PersonalizationStep/PersonalizationStepTabs.tsx",
    "frontend/src/components/OnboardingWizard/PersonalizationStep/personaGenerationCache.ts",
    "frontend/src/components/OnboardingWizard/PersonalizationStep/personaGenerationCache.test.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/FinalStep.tsx",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepCapabilities.tsx",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepConstants.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepDataMapper.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepDataMapper.test.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepValidation.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/finalStepValidation.test.ts",
    "frontend/src/components/OnboardingWizard/FinalStep/useFinalStepData.ts"
)

$STACK = @(
    @{ Branch = "fix/onboarding-website-change-invalidation"; Base = $MAIN; Msg = "fix(onboarding): invalidate downstream data when Connect website URL changes"; Files = $PR1_FILES },
    @{ Branch = "feat/onboarding-latest-only-analysis"; Base = "fix/onboarding-website-change-invalidation"; Msg = "feat(onboarding): latest-only website analysis policy and accurate last-analyzed date"; Files = $PR2_FILES },
    @{ Branch = "fix/onboarding-live-website-session"; Base = "feat/onboarding-latest-only-analysis"; Msg = "fix(onboarding): live website session prevents stale Research/Persona across steps"; Files = $PR3_FILES },
    @{ Branch = "fix/onboarding-progress-bar-navigation"; Base = "fix/onboarding-live-website-session"; Msg = "fix(onboarding): allow progress bar navigation within unlocked steps"; Files = $PR4_FILES },
    @{ Branch = "fix/onboarding-research-step-restore"; Base = "fix/onboarding-progress-bar-navigation"; Msg = "fix(onboarding): restore completed Research on step navigation without re-running discovery"; Files = $PR5_FILES },
    @{ Branch = "feat/onboarding-wizard-resume-and-polish"; Base = "fix/onboarding-research-step-restore"; Msg = "feat(onboarding): resume toast, unified success toasts, and URL autofill styling"; Files = $PR6_FILES },
    @{ Branch = "refactor/onboarding-background-and-steps"; Base = "feat/onboarding-wizard-resume-and-polish"; Msg = "refactor(onboarding): modular Background Setup, Personalization, and Final steps"; Files = $PR7_FILES }
)

git checkout $MAIN

foreach ($pr in $STACK) {
    $branch = $pr.Branch
    $base = $pr.Base
    Write-Host "=== Creating $branch from $base ===" -ForegroundColor Cyan
    git branch -D $branch 2>$null | Out-Null
    git checkout -b $branch $base
    Checkout-WipFiles -Files $pr.Files
    git add -A
    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No changes for $branch - skipping commit" -ForegroundColor Yellow
        continue
    }
    git commit -m $pr.Msg
}

git checkout refactor/onboarding-background-and-steps
Write-Host "Stack complete at tip: refactor/onboarding-background-and-steps" -ForegroundColor Green

import json
import logging
from typing import Dict, Any, List
from datetime import datetime

from services.llm_providers.gemini_provider import gemini_structured_json_response
from services.strategy_service import StrategyService
from services.monitoring_metrics import ALLOWED_METRICS, ALLOWED_FREQUENCIES, ALLOWED_ASSIGNEES, ALLOWED_COMPONENTS, LEGACY_METRIC_MAP
from services.deterministic_monitoring_factory import DeterministicMonitoringFactory

logger = logging.getLogger(__name__)

class MonitoringPlanGenerator:
    def __init__(self):
        self.strategy_service = StrategyService()
    
    async def generate_monitoring_plan(self, strategy_id: int, user_id: str = None, use_deterministic: bool = True) -> Dict[str, Any]:
        """Generate comprehensive monitoring plan for a strategy (deterministic by default)."""
        try:
            strategy_data = await self.strategy_service.get_strategy_by_id(strategy_id)
            if not strategy_data:
                raise Exception(f"Strategy with ID {strategy_id} not found")
            prompt_context = self._prepare_prompt_context(strategy_data)
            logger.debug(
                "MonitoringPlanGenerator: Prepared prompt context | strategy_id=%s | keys=%s",
                strategy_id,
                list(prompt_context.keys())
            )
            if use_deterministic:
                factory = DeterministicMonitoringFactory()
                monitoring_plan = factory.build_plan(strategy_data, user_id=user_id)
                logger.info(f"MonitoringPlanGenerator: Deterministic plan built | total={monitoring_plan.get('totalTasks')}")
            else:
                monitoring_plan = await self._generate_plan_with_ai(prompt_context)
            if not self._validate_monitoring_plan(monitoring_plan):
                raise Exception("Generated monitoring plan has invalid structure")
            enhanced_plan = await self._enhance_monitoring_plan(monitoring_plan, strategy_data)
            await self._save_monitoring_plan(strategy_id, enhanced_plan)
            logger.info(f"Successfully generated monitoring plan for strategy {strategy_id}")
            return enhanced_plan
        except Exception as e:
            logger.error(f"Error generating monitoring plan for strategy {strategy_id}: {e}")
            raise Exception(f"Failed to generate monitoring plan: {str(e)}")

    def generate_deterministic_plan(self, strategy_data: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        factory = DeterministicMonitoringFactory()
        return factory.build_plan(strategy_data, user_id=user_id)
    
    def _prepare_prompt_context(self, strategy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare context for AI prompt"""
        
        # Extract strategy components
        strategic_insights = strategy_data.get('strategic_insights', {})
        competitive_analysis = strategy_data.get('competitive_analysis', {})
        performance_predictions = strategy_data.get('performance_predictions', {})
        implementation_roadmap = strategy_data.get('implementation_roadmap', {})
        risk_assessment = strategy_data.get('risk_assessment', {})
        
        return {
            "strategy_name": strategy_data.get('name', 'Content Strategy'),
            "industry": strategy_data.get('industry', 'General'),
            "business_goals": strategy_data.get('business_goals', []),
            "content_pillars": strategy_data.get('content_pillars', []),
            "target_audience": strategy_data.get('target_audience', {}),
            "competitive_landscape": competitive_analysis.get('competitors', []),
            "strategic_insights": strategic_insights,
            "performance_predictions": performance_predictions,
            "implementation_roadmap": implementation_roadmap,
            "risk_assessment": risk_assessment
        }
    
    async def _generate_plan_with_ai(self, prompt_context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate monitoring plan using AI"""
        
        prompt = self._build_monitoring_prompt(prompt_context)
        logger.debug(
            "MonitoringPlanGenerator: Built prompt | length=%s | preview=%s...",
            len(prompt),
            (prompt[:240].replace("\n", " ") if isinstance(prompt, str) else "<non-str>")
        )
        
        # Define schema for 8 tasks (2 per component) to avoid truncation
        monitoring_plan_schema = {
            "type": "object",
            "properties": {
                "monitoringTasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "component": {"type": "string"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "assignee": {"type": "string"},
                            "frequency": {"type": "string"},
                            "metric": {"type": "string"},
                            "measurementMethod": {"type": "string"},
                            "successCriteria": {"type": "string"},
                            "alertThreshold": {"type": "string"},
                            "actionableInsights": {"type": "string"}
                        }
                    }
                }
            }
        }
        logger.debug(
            "MonitoringPlanGenerator: Schema prepared | schema_type=%s",
            type(monitoring_plan_schema).__name__
        )
        
        try:
            # Structured response only (no fallback)
            logger.info("MonitoringPlanGenerator: Invoking Gemini structured JSON response")
            response = gemini_structured_json_response(
                prompt=prompt,
                schema=monitoring_plan_schema,
                temperature=0.1,
                max_tokens=8192
            )

            logger.debug(
                "MonitoringPlanGenerator: Received AI response | type=%s",
                type(response)
            )
            
            # Handle response - gemini_structured_json_response returns dict directly
            if isinstance(response, dict):
                if "error" in response:
                    logger.error("MonitoringPlanGenerator: Gemini returned error dict | error=%s", response.get("error"))
                    raise Exception(f"Gemini error: {response.get('error')}")
                logger.debug(
                    "MonitoringPlanGenerator: Parsed response dict keys=%s",
                    list(response.keys())
                )
                monitoring_plan = response
            elif isinstance(response, str):
                # If it's a string, try to parse as JSON
                try:
                    monitoring_plan = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error("MonitoringPlanGenerator: Failed to parse AI response as JSON: %s", e)
                    raise Exception(f"Invalid AI response format: {str(e)}")
            else:
                logger.error("MonitoringPlanGenerator: Unexpected response type from AI service: %s", type(response))
                raise Exception(f"Unexpected response type from AI service: {type(response)}")

            logger.info(
                "MonitoringPlanGenerator: AI monitoring plan generated | has_tasks=%s",
                isinstance(monitoring_plan.get("monitoringTasks"), list)
            )
            
            # Compute totals from the returned tasks
            monitoring_tasks = monitoring_plan.get("monitoringTasks", [])
            total_tasks = len(monitoring_tasks)
            alwrity_tasks = sum(1 for task in monitoring_tasks if task.get("assignee") == "ALwrity")
            human_tasks = sum(1 for task in monitoring_tasks if task.get("assignee") == "Human")
            
            # Add computed totals to the plan
            monitoring_plan["totalTasks"] = total_tasks
            monitoring_plan["alwrityTasks"] = alwrity_tasks
            monitoring_plan["humanTasks"] = human_tasks
            monitoring_plan["metricsCount"] = total_tasks
            
            logger.info(
                "MonitoringPlanGenerator: Computed totals | total=%s | alwrity=%s | human=%s",
                total_tasks, alwrity_tasks, human_tasks
            )
            
            return monitoring_plan
                
        except Exception as e:
            logger.error(f"Error calling AI service: {e}")
            raise Exception(f"AI service error: {str(e)}")
    
    def _build_monitoring_prompt(self, context: Dict[str, Any]) -> str:
        """Build the AI prompt for monitoring plan generation"""
        
        return f"""Generate a monitoring plan for content strategy: {context['strategy_name']} in {context['industry']} industry.

Create exactly 8 monitoring tasks (2 per component) across 5 strategy components:
1. Strategic Insights
2. Competitive Analysis  
3. Performance Predictions
4. Implementation Roadmap
5. Risk Assessment

Each task must include: component, title, description, assignee (ALwrity or Human), frequency (Daily, Weekly, Monthly, or Quarterly), metric, measurement method, success criteria, alert threshold, and actionable insights.

Return a JSON object with monitoringTasks array containing 8 task objects."""
    
    def _generate_default_plan(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a default monitoring plan if AI fails"""
        
        return {
            "totalTasks": 15,
            "alwrityTasks": 10,
            "humanTasks": 5,
            "metricsCount": 15,
            "components": [
                {
                    "name": "Strategic Insights",
                    "icon": "TrendingUpIcon",
                    "tasks": [
                        {
                            "title": "Monitor Market Positioning Effectiveness",
                            "description": "Track how well the strategic positioning is performing in the market",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Market Position Score",
                            "measurementMethod": "Competitive analysis and brand mention tracking",
                            "successCriteria": "Maintain top 3 market position",
                            "alertThreshold": "Drop below top 5 position"
                        },
                        {
                            "title": "Track Strategic Goal Achievement",
                            "description": "Monitor progress toward defined business objectives",
                            "assignee": "Human",
                            "frequency": "Monthly",
                            "metric": "Goal Achievement Rate",
                            "measurementMethod": "KPI tracking and business metrics analysis",
                            "successCriteria": "Achieve 80% of strategic goals",
                            "alertThreshold": "Drop below 60% achievement"
                        },
                        {
                            "title": "Analyze Strategic Insights Performance",
                            "description": "Evaluate the effectiveness of strategic insights and recommendations",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Insight Effectiveness Score",
                            "measurementMethod": "Performance data analysis and trend identification",
                            "successCriteria": "Maintain 85%+ effectiveness score",
                            "alertThreshold": "Drop below 70% effectiveness"
                        }
                    ]
                },
                {
                    "name": "Competitive Analysis",
                    "icon": "EmojiEventsIcon",
                    "tasks": [
                        {
                            "title": "Monitor Competitor Activities",
                            "description": "Track competitor content strategies and market activities",
                            "assignee": "ALwrity",
                            "frequency": "Daily",
                            "metric": "Competitor Activity Score",
                            "measurementMethod": "Automated competitor monitoring and analysis",
                            "successCriteria": "Stay ahead of competitor activities",
                            "alertThreshold": "Competitor gains significant advantage"
                        },
                        {
                            "title": "Track Competitive Positioning",
                            "description": "Monitor our competitive position in the market",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Competitive Position Rank",
                            "measurementMethod": "Market share and positioning analysis",
                            "successCriteria": "Maintain top 3 competitive position",
                            "alertThreshold": "Drop below top 5 position"
                        },
                        {
                            "title": "Validate Competitive Intelligence",
                            "description": "Review and validate competitive analysis insights",
                            "assignee": "Human",
                            "frequency": "Monthly",
                            "metric": "Intelligence Accuracy Score",
                            "measurementMethod": "Manual review and validation",
                            "successCriteria": "Maintain 90%+ accuracy",
                            "alertThreshold": "Drop below 80% accuracy"
                        }
                    ]
                },
                {
                    "name": "Performance Predictions",
                    "icon": "AssessmentIcon",
                    "tasks": [
                        {
                            "title": "Monitor Prediction Accuracy",
                            "description": "Track the accuracy of performance predictions",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Prediction Accuracy Rate",
                            "measurementMethod": "Compare predictions with actual performance",
                            "successCriteria": "Maintain 85%+ prediction accuracy",
                            "alertThreshold": "Drop below 70% accuracy"
                        },
                        {
                            "title": "Update Prediction Models",
                            "description": "Refine prediction models based on new data",
                            "assignee": "ALwrity",
                            "frequency": "Monthly",
                            "metric": "Model Performance Score",
                            "measurementMethod": "Model validation and performance testing",
                            "successCriteria": "Improve model performance by 5%+",
                            "alertThreshold": "Model performance degrades"
                        },
                        {
                            "title": "Review Prediction Insights",
                            "description": "Analyze prediction insights and business implications",
                            "assignee": "Human",
                            "frequency": "Monthly",
                            "metric": "Insight Actionability Score",
                            "measurementMethod": "Manual review and business analysis",
                            "successCriteria": "Generate actionable insights",
                            "alertThreshold": "Insights become less actionable"
                        }
                    ]
                },
                {
                    "name": "Implementation Roadmap",
                    "icon": "CheckCircleIcon",
                    "tasks": [
                        {
                            "title": "Track Implementation Progress",
                            "description": "Monitor progress on implementation roadmap milestones",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Implementation Progress Rate",
                            "measurementMethod": "Milestone tracking and progress analysis",
                            "successCriteria": "Achieve 90%+ of milestones on time",
                            "alertThreshold": "Fall behind by more than 2 weeks"
                        },
                        {
                            "title": "Monitor Resource Utilization",
                            "description": "Track resource allocation and utilization efficiency",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Resource Efficiency Score",
                            "measurementMethod": "Resource tracking and efficiency analysis",
                            "successCriteria": "Maintain 85%+ resource efficiency",
                            "alertThreshold": "Drop below 70% efficiency"
                        },
                        {
                            "title": "Review Implementation Effectiveness",
                            "description": "Evaluate the effectiveness of implementation strategies",
                            "assignee": "Human",
                            "frequency": "Monthly",
                            "metric": "Implementation Success Rate",
                            "measurementMethod": "Manual review and effectiveness assessment",
                            "successCriteria": "Achieve 80%+ implementation success",
                            "alertThreshold": "Drop below 60% success rate"
                        }
                    ]
                },
                {
                    "name": "Risk Assessment",
                    "icon": "StarIcon",
                    "tasks": [
                        {
                            "title": "Monitor Risk Indicators",
                            "description": "Track identified risk factors and their status",
                            "assignee": "ALwrity",
                            "frequency": "Daily",
                            "metric": "Risk Level Score",
                            "measurementMethod": "Risk factor monitoring and analysis",
                            "successCriteria": "Maintain low risk level (score < 30)",
                            "alertThreshold": "Risk level increases above 50"
                        },
                        {
                            "title": "Track Risk Mitigation Effectiveness",
                            "description": "Monitor the effectiveness of risk mitigation strategies",
                            "assignee": "ALwrity",
                            "frequency": "Weekly",
                            "metric": "Mitigation Effectiveness Rate",
                            "measurementMethod": "Risk reduction tracking and analysis",
                            "successCriteria": "Achieve 80%+ risk mitigation success",
                            "alertThreshold": "Drop below 60% mitigation success"
                        },
                        {
                            "title": "Review Risk Management Decisions",
                            "description": "Evaluate risk management decisions and their outcomes",
                            "assignee": "Human",
                            "frequency": "Monthly",
                            "metric": "Risk Management Score",
                            "measurementMethod": "Manual review and decision analysis",
                            "successCriteria": "Maintain 85%+ risk management effectiveness",
                            "alertThreshold": "Drop below 70% effectiveness"
                        }
                    ]
                }
            ]
        }
    
    async def _enhance_monitoring_plan(self, plan: Dict[str, Any], strategy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance AI-generated plan with additional context and validation"""
        
        enhanced_plan = plan.copy()
        
        # Add monitoring schedule
        enhanced_plan["monitoringSchedule"] = {
            "dailyChecks": ["Performance metrics", "Alert monitoring", "Risk indicators"],
            "weeklyReviews": ["Trend analysis", "Competitive updates", "Implementation progress"],
            "monthlyAssessments": ["Strategy effectiveness", "Goal progress", "Risk management"],
            "quarterlyPlanning": ["Strategy optimization", "Goal refinement", "Resource allocation"]
        }
        
        # Add success metrics
        enhanced_plan["successMetrics"] = {
            "trafficGrowth": {"target": "25%+", "current": "0%"},
            "engagementRate": {"target": "15%+", "current": "0%"},
            "conversionRate": {"target": "10%+", "current": "0%"},
            "roi": {"target": "3:1+", "current": "0:1"},
            "strategyAdoption": {"target": "90%+", "current": "0%"},
            "contentQuality": {"target": "85%+", "current": "0%"},
            "competitivePosition": {"target": "Top 3", "current": "Unknown"},
            "audienceGrowth": {"target": "20%+", "current": "0%"}
        }
        
        # Add metadata
        enhanced_plan["metadata"] = {
            "generatedAt": datetime.now().isoformat(),
            "strategyId": strategy_data.get('id'),
            "strategyName": strategy_data.get('name'),
            "version": "1.0"
        }
        
        return enhanced_plan
    
    async def _save_monitoring_plan(self, strategy_id: int, plan: Dict[str, Any]):
        """Save monitoring plan to database"""
        try:
            # Use the strategy service to save the monitoring plan
            success = await self.strategy_service.save_monitoring_plan(strategy_id, plan)
            
            if success:
                logger.info(f"Monitoring plan saved to database for strategy {strategy_id}")
            else:
                logger.warning(f"Failed to save monitoring plan to database for strategy {strategy_id}")
            
        except Exception as e:
            logger.error(f"Error saving monitoring plan: {e}")
            # Don't raise the error as the plan generation was successful
    
    def _validate_monitoring_plan(self, plan: Dict[str, Any]) -> bool:
        try:
            monitoring_tasks = plan.get("monitoringTasks", [])
            if not isinstance(monitoring_tasks, list):
                logger.error("monitoringTasks must be a list")
                return False
            if len(monitoring_tasks) == 0:
                logger.error("No monitoring tasks generated")
                return False
            if not (3 <= len(monitoring_tasks) <= 13):
                logger.warning(f"Monitoring tasks count out of deterministic range 3-13, got {len(monitoring_tasks)}")
            required_task_fields = [
                "component", "title", "description", "assignee", "frequency",
                "metric", "measurementMethod", "successCriteria", "alertThreshold", "actionableInsights"
            ]
            for i, task in enumerate(monitoring_tasks):
                for field in required_task_fields:
                    if field not in task:
                        logger.error(f"Task {i} missing required field: {field}")
                        return False
                if task.get("assignee") not in ALLOWED_ASSIGNEES:
                    logger.error(f"Task {i} has invalid assignee: {task.get('assignee')}")
                    return False
                if task.get("frequency") not in ALLOWED_FREQUENCIES:
                    logger.error(f"Task {i} has invalid frequency: {task.get('frequency')}")
                    return False
                if task.get("component") not in ALLOWED_COMPONENTS:
                    logger.error(f"Task {i} has invalid component: {task.get('component')}")
                    return False
                metric = task.get("metric")
                if metric not in ALLOWED_METRICS:
                    if metric in LEGACY_METRIC_MAP:
                        logger.warning(f"Task {i} legacy metric {metric} mapped to {LEGACY_METRIC_MAP[metric]}")
                    else:
                        logger.error(f"Task {i} has hallucinated metric: {metric} not in allow-list")
                        return False
                tool = task.get("tool") or task.get("measurementMethod")
                if task.get("assignee") == "ALwrity" and tool == "manual.human_review":
                    logger.error(f"Task {i} ALwrity task cannot use manual.human_review")
                    return False
            computed_fields = ["totalTasks", "alwrityTasks", "humanTasks", "metricsCount"]
            for field in computed_fields:
                if field not in plan:
                    logger.error(f"Missing computed field in monitoring plan: {field}")
                    return False
            return True
        except Exception as e:
            logger.error(f"Error validating monitoring plan: {e}")
            return False

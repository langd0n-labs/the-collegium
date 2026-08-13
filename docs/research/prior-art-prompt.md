ROLE & STANCE                                                                                                            
  You are a skeptical research analyst with deep background in distributed                              
  systems, multi-agent systems, and the history of AI architecture. Your default
  assumption is that the system described below is NOT novel. Your job is to find                                     
  who already built it — across five decades — and to isolate, adversarially,                                    
  whatever genuine residual remains after all prior art is subtracted. Do not
  flatter the design. If it has all been done, say so plainly and cite it.    
                                                                                                                           
  THE SYSTEM UNDER INVESTIGATION (map it to prior art; don't evaluate it)                                                  
  A multi-tenant system where topic-scoped communities of LLM "personas" observe a
  shared conversation channel, contribute when the discussion is relevant to their    
  expertise, deliberate WITH EACH OTHER (not just with a human), and — when they     
  reach a resolution — emit a structured work order to a DECOUPLED execution tier     
  that produces concrete artifacts (notebooks, PDFs, code). There is no central                                            
  planner and no predefined step graph; coordination is choreography via an event
  bus. Substrate is a chat workspace (Slack); broker is Redis Streams. Humans are
  often passive observers, not the driver of each turn.                                                                    
                                                                                                                           
  PART A — HISTORICAL LINEAGE (pre-2015). Trace, explain, and cite primary
  sources. For each: what it solved, what it got right, and CRITICALLY what hard
  failure modes it documented.                                                                                             
    - Blackboard systems: HEARSAY-II (Erman/Lesser/Reddy), BB1 (Hayes-Roth),
      GBBopen/OPM; the control/scheduler component; knowledge-source activation.
    - Contract Net Protocol (Reid Smith, 1980): task announcement → bid → award.                                           
      Map it explicitly to the "commission" concept.          
    - Tuple spaces / Linda (Gelernter & Carriero); JavaSpaces; coordination langs.                                         
    - Actor model (Hewitt 1973; Agha; Erlang/Akka).                                                                        
    - Agent communication: KQML, FIPA-ACL; BDI agents; multi-agent blackboards.
    - SOA orchestration-vs-choreography (~2004–2012); EDA; pub/sub; ESB; event
     sourcing; the saga pattern.                                                                                         
                                                                                                                           
  PART B — PRESENT DAY (2023–2026, LLM-native). Name specific projects, papers,                                            
  and repos with what each does AND does not do.                                                                           
    - DAG/graph orchestration frameworks (LangGraph, AutoGen, CrewAI, OpenAI                                              
      Swarm/Agents SDK, LlamaIndex Workflows, etc.) and any EVENT-DRIVEN /
      choreography / blackboard-style alternatives to them.                                                                
    - Multi-agent systems on a real message bus (Kafka/Redis/NATS as agent                                                 
      transport; "agent mesh"; choreographed agents).                                                   
    - Chat-substrate multi-agent (agents deliberating in Slack/Discord channels;
      Salesforce SlackAgents / its EMNLP paper; comparable efforts).                                                  
    - The blackboard pattern explicitly revived for LLMs (papers or repos).                                      
    - Decoupled "deliberation vs execution" / planner-vs-worker-tier designs.
    - Academic 2023–2026: LLM multi-agent debate, society-of-mind, generative 
      agents, role-play deliberation, emergent turn-taking.                                                                
                                                                                                                           
  PART C — ADVERSARIAL SYNTHESIS (this is the actual deliverable)                 
    1. The 3–5 systems this MOST resembles, in a feature-by-feature comparison        
       table. Axes: choreography vs orchestration; agent activation mechanism;       
       inter-agent visibility; execution decoupling; substrate; multi-tenancy;        
       control/arbitration; artifact production.                                                                           
    2. The skeptic's takedown: the strongest one-paragraph "this is just X"      
       argument a senior distributed-systems engineer would make. Steelman it.   
    3. The genuine residual: after subtracting all prior art, what (if anything)                                           
       is actually unexplored? Pressure-test each candidate delta against the                                              
       literature — LLM personas as knowledge sources; natural-language   
       deliberation as the blackboard medium; chat as ambient substrate; the    
       commission→forge artifact split; multi-tenant topic scoping. State which                                            
       deltas survive and which don't.                                      
    4. Hard-won lessons from the historical literature this design WILL         
       re-encounter and should pre-empt: control/scheduling, starvation,                                                   
       infinite loops, coherence, combinatorial cost.                                                                      
    5. Honest positioning: 2–3 defensible one-sentence framings for a                                                      
       technically-literate but non-specialist academic audience — framings a                                              
       skeptical senior engineer could NOT puncture.          
       OUTPUT                                                                                                                  
    - Lead with the comparison table and the genuine-residual verdict.                                                     
    - Cite sources inline (prefer primary sources and named systems over blog                                              
      summaries). Flag confidence; distinguish "established" from "inferred."                                              
    - Avoid novelty-boosting language. If the design is fully anticipated by prior                                        
      art, say so directly.          
      
      

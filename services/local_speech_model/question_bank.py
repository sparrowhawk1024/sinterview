import random
from typing import List, Dict, Any

QUESTION_BANK: Dict[str, Dict[str, Dict[str, List[Dict[str, str]]]]] = {
    "Software Engineer": {
        "Easy": {
            "Technical": [
                {"text": "Explain the difference between a process and a thread.", "category": "Operating Systems"},
                {"text": "What is the difference between a stack and a queue data structure?", "category": "Data Structures"},
                {"text": "Explain the concepts of Object-Oriented Programming (OOP).", "category": "Software Design"},
                {"text": "What is a REST API and how does it differ from GraphQL?", "category": "Web Development"},
                {"text": "How does git rebase differ from git merge?", "category": "DevOps/Tools"}
            ],
            "Behavioral": [
                {"text": "Tell me about yourself and your background in software engineering.", "category": "Introduction"},
                {"text": "Describe a project you worked on recently and your specific contributions.", "category": "Experience"},
                {"text": "How do you handle debugging a hard problem when pressed for time?", "category": "Problem Solving"}
            ],
            "Mixed": [
                {"text": "Tell me about a technical project you built and the key architecture decisions you made.", "category": "General"},
                {"text": "Explain how authentication differs from authorization.", "category": "Security"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "Explain database normalization and the trade-offs of denormalization.", "category": "Databases"},
                {"text": "What happens under the hood when you enter a URL into a web browser?", "category": "Networking"},
                {"text": "How do indexing and B-trees speed up database query performance?", "category": "Databases"},
                {"text": "Describe memory leaks in garbage-collected languages and how to detect them.", "category": "Core Concepts"},
                {"text": "How do you design a thread-safe cache in memory?", "category": "Concurrency"}
            ],
            "Behavioral": [
                {"text": "Describe a conflict you had with a team member on technical design and how you resolved it.", "category": "Collaboration"},
                {"text": "Tell me about a time when a production incident occurred under your watch. How did you respond?", "category": "Incident Response"}
            ],
            "Mixed": [
                {"text": "How do you balance writing clean code with meeting tight project deadlines?", "category": "Engineering Culture"},
                {"text": "Explain the CAP theorem and how it applies to distributed database systems.", "category": "Distributed Systems"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design a distributed rate limiter like the one used at Cloudflare or Stripe.", "category": "System Design"},
                {"text": "How would you design a real-time collaborative document editor like Google Docs?", "category": "System Design"},
                {"text": "Explain consensus algorithms like Paxos or Raft and how distributed locks work.", "category": "Distributed Systems"},
                {"text": "How do LSM trees differ from B+ trees in high-throughput write workloads?", "category": "Storage Engines"}
            ],
            "Behavioral": [
                {"text": "Tell me about a major technical decision you made that turned out to be wrong. What did you learn?", "category": "Leadership/Growth"}
            ],
            "Mixed": [
                {"text": "How do you approach refactoring a legacy monolithic application into microservices?", "category": "Architecture"}
            ]
        }
    },
    "Backend Developer": {
        "Easy": {
            "Technical": [
                {"text": "What is the HTTP protocol and what are the main request methods?", "category": "Web Protocols"},
                {"text": "Explain primary keys, foreign keys, and indexes in relational databases.", "category": "Databases"},
                {"text": "What is JSON Web Token (JWT) and how is it used for stateless authentication?", "category": "Security"}
            ],
            "Behavioral": [
                {"text": "Why do you specialize in backend development?", "category": "Career Focus"}
            ],
            "Mixed": [
                {"text": "Explain how ORMs work and when raw SQL queries are preferred.", "category": "Database"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "Explain message queues like RabbitMQ or Kafka and when you would use asynchronous processing.", "category": "Messaging"},
                {"text": "How do connection pooling and database transactions work?", "category": "Databases"},
                {"text": "What are idempotent API endpoints and why are they crucial for payment processing?", "category": "API Design"}
            ],
            "Behavioral": [
                {"text": "Describe how you optimize slow backend API endpoints in production.", "category": "Performance"}
            ],
            "Mixed": [
                {"text": "How do Redis caching strategies like Cache-Aside, Write-Through, and Write-Behind differ?", "category": "Caching"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design an URL shortener service like Bitly that scales to 100M active links.", "category": "System Design"},
                {"text": "How do database sharding, replication, and failover work in distributed databases?", "category": "Scalability"}
            ],
            "Behavioral": [
                {"text": "How do you handle API breaking changes and backward compatibility across mobile clients?", "category": "API Governance"}
            ],
            "Mixed": [
                {"text": "Describe event-driven architecture and event sourcing.", "category": "Architecture"}
            ]
        }
    },
    "Frontend Developer": {
        "Easy": {
            "Technical": [
                {"text": "Explain the DOM, Virtual DOM, and how rendering performance is optimized.", "category": "Web Fundamentals"},
                {"text": "What is the CSS box model and how do flexbox and CSS grid differ?", "category": "Styling"},
                {"text": "Explain JavaScript closures, hoisting, and event loop.", "category": "JavaScript"}
            ],
            "Behavioral": [
                {"text": "How do you collaborate with UX/UI designers during project handover?", "category": "Collaboration"}
            ],
            "Mixed": [
                {"text": "What are web accessibility (a11y) standards and how do you implement ARIA attributes?", "category": "Accessibility"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "Compare Server-Side Rendering (SSR), Static Site Generation (SSG), and Client-Side Rendering (CSR).", "category": "Frameworks"},
                {"text": "How do state management libraries like Redux or Zustand manage global application state?", "category": "State Management"},
                {"text": "How do web workers, Service Workers, and PWA caching work?", "category": "Performance"}
            ],
            "Behavioral": [
                {"text": "Tell me about a complex UI widget you built and how you ensured cross-browser compatibility.", "category": "Engineering"}
            ],
            "Mixed": [
                {"text": "How do you prevent cross-site scripting (XSS) and CSRF attacks on the frontend?", "category": "Security"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design a frontend micro-frontend architecture for a multi-team enterprise portal.", "category": "Frontend Architecture"},
                {"text": "How do web browsers render pixels from HTML/CSS parse trees to compositing layers?", "category": "Browser Engines"}
            ],
            "Behavioral": [
                {"text": "How do you establish component design systems across multiple frontend products?", "category": "Leadership"}
            ],
            "Mixed": [
                {"text": "How do WebSockets and Server-Sent Events (SSE) compare for live streaming dashboards?", "category": "Real-time"}
            ]
        }
    },
    "Machine Learning Engineer": {
        "Easy": {
            "Technical": [
                {"text": "What is the difference between supervised, unsupervised, and reinforcement learning?", "category": "ML Fundamentals"},
                {"text": "Explain overfitting vs underfitting and how regularization helps.", "category": "Model Training"},
                {"text": "What are precision, recall, F1 score, and ROC-AUC curves?", "category": "Metrics"}
            ],
            "Behavioral": [
                {"text": "How do you approach a new data science problem when datasets are noisy or incomplete?", "category": "Workflow"}
            ],
            "Mixed": [
                {"text": "Explain gradient descent and the role of learning rate hyperparameters.", "category": "Optimization"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "Explain the self-attention mechanism and Transformer architecture.", "category": "Deep Learning"},
                {"text": "How do vector databases (like Pinecone, Qdrant, Milvus) enable semantic search and RAG?", "category": "LLMs/NLP"},
                {"text": "Describe feature engineering techniques for categorical, numerical, and text data.", "category": "Data Engineering"}
            ],
            "Behavioral": [
                {"text": "How do you explain machine learning model outputs and metrics to non-technical stakeholders?", "category": "Communication"}
            ],
            "Mixed": [
                {"text": "How do Quantization, LoRA, and FlashAttention optimize LLM inference performance?", "category": "Model Serving"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design an MLOps pipeline for continuous training, feature store, and model monitoring in production.", "category": "MLOps"},
                {"text": "How would you design a real-time recommendation system handling millions of queries per second?", "category": "System Design"}
            ],
            "Behavioral": [
                {"text": "Tell me about a time an ML model failed in production due to data drift. How did you resolve it?", "category": "Production"}
            ],
            "Mixed": [
                {"text": "Compare model distillation vs pruning vs quantization for edge deployment.", "category": "Optimization"}
            ]
        }
    },
    "Data Scientist": {
        "Easy": {
            "Technical": [
                {"text": "What is p-value and statistical significance in A/B testing?", "category": "Statistics"},
                {"text": "Explain linear regression assumptions and cost functions.", "category": "Modeling"}
            ],
            "Behavioral": [
                {"text": "How do you prioritize data analysis tasks when faced with competing business demands?", "category": "Prioritization"}
            ],
            "Mixed": [
                {"text": "How do you handle missing values or outliers in datasets?", "category": "Data Wrangling"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "How do Decision Trees, Random Forests, and XGBoost gradient boosting algorithms differ?", "category": "Tree Models"},
                {"text": "Explain hypothesis testing, Type I / Type II errors, and sample size calculations.", "category": "A/B Testing"}
            ],
            "Behavioral": [
                {"text": "Describe a project where your data insight directly altered business strategy.", "category": "Business Impact"}
            ],
            "Mixed": [
                {"text": "Explain Principal Component Analysis (PCA) and dimensionality reduction.", "category": "Unsupervised Learning"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design a causal inference framework to evaluate product feature impact without randomized experiment.", "category": "Causal Inference"}
            ],
            "Behavioral": [
                {"text": "How do you ensure ethical AI practices and prevent algorithmic bias in machine learning models?", "category": "Ethics"}
            ],
            "Mixed": [
                {"text": "How do time series forecasting models like ARIMA compare to Prophet and Transformer-based models?", "category": "Time Series"}
            ]
        }
    },
    "DevOps Engineer": {
        "Easy": {
            "Technical": [
                {"text": "Explain the difference between containers (Docker) and virtual machines.", "category": "Virtualization"},
                {"text": "What is CI/CD and why is automated deployment essential?", "category": "CI/CD"}
            ],
            "Behavioral": [
                {"text": "Why are you passionate about Site Reliability Engineering and DevOps?", "category": "Introduction"}
            ],
            "Mixed": [
                {"text": "What is Infrastructure as Code (IaC) and how does Terraform work?", "category": "IaC"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "How do Kubernetes Pods, Deployments, Services, and Ingress controllers work together?", "category": "Kubernetes"},
                {"text": "Explain Blue-Green deployments vs Canary deployments.", "category": "Deployments"}
            ],
            "Behavioral": [
                {"text": "Walk me through your post-mortem process after a critical server outage.", "category": "Incidents"}
            ],
            "Mixed": [
                {"text": "How do Prometheus, Grafana, and ELK stack provide observability?", "category": "Observability"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design a multi-region disaster recovery architecture for an enterprise database application.", "category": "High Availability"}
            ],
            "Behavioral": [
                {"text": "How do you enforce security compliance and zero-trust policies in cloud infrastructure?", "category": "DevSecOps"}
            ],
            "Mixed": [
                {"text": "Describe GitOps workflow with ArgoCD or Flux in production Kubernetes clusters.", "category": "GitOps"}
            ]
        }
    },
    "Product Manager": {
        "Easy": {
            "Technical": [
                {"text": "How do you define key performance metrics (KPIs) for a new mobile application?", "category": "Metrics"},
                {"text": "What is the difference between MVP and MLP (Minimum Lovable Product)?", "category": "Product Strategy"}
            ],
            "Behavioral": [
                {"text": "Tell me about a product feature you built from conception to launch.", "category": "Execution"}
            ],
            "Mixed": [
                {"text": "How do you prioritize features using frameworks like RICE or MoSCoW?", "category": "Prioritization"}
            ]
        },
        "Medium": {
            "Technical": [
                {"text": "How would you improve user retention for an e-commerce mobile application?", "category": "Product Design"},
                {"text": "Walk me through how you conduct user interviews and convert feedback into product specs.", "category": "User Research"}
            ],
            "Behavioral": [
                {"text": "Describe how you handle disagreement with engineering leaders regarding release timelines.", "category": "Stakeholders"}
            ],
            "Mixed": [
                {"text": "How do you design and interpret A/B test experiments for onboarding funnels?", "category": "Analytics"}
            ]
        },
        "Hard": {
            "Technical": [
                {"text": "Design a monetization and growth strategy for a new B2B SaaS platform.", "category": "Business Strategy"}
            ],
            "Behavioral": [
                {"text": "Tell me about a failed product launch and how you managed stakeholder expectations.", "category": "Crisis Management"}
            ],
            "Mixed": [
                {"text": "How do you balance tech debt reduction with new feature requests?", "category": "Roadmapping"}
            ]
        }
    }
}


def get_fallback_questions(
    role: str,
    difficulty: str,
    interview_type: str,
    count: int = 5,
    exclude_texts: List[str] = None
) -> List[Dict[str, str]]:
    if exclude_texts is None:
        exclude_texts = []

    # Map role or fallback to Software Engineer
    role_dict = QUESTION_BANK.get(role, QUESTION_BANK["Software Engineer"])
    # Map difficulty or fallback to Medium
    diff_dict = role_dict.get(difficulty, role_dict.get("Medium", list(role_dict.values())[0]))
    # Map interview type or fallback to Mixed/Technical
    type_questions = diff_dict.get(interview_type)
    if not type_questions:
        type_questions = diff_dict.get("Technical") or diff_dict.get("Mixed") or []

    # If count exceeds available questions, pool from other types/difficulties
    all_available = list(type_questions)
    
    if len(all_available) < count:
        for d in ["Medium", "Easy", "Hard"]:
            if d in role_dict:
                for t in ["Technical", "Behavioral", "Mixed"]:
                    if t in role_dict[d]:
                        for q in role_dict[d][t]:
                            if q not in all_available:
                                all_available.append(q)

    # Filter out excluded texts to prevent duplicate questions
    candidate_questions = [q for q in all_available if q["text"] not in exclude_texts]
    if len(candidate_questions) < count:
        candidate_questions = all_available

    # Pick up to count questions
    selected = candidate_questions[:count]
    return selected


def get_bank_metadata() -> Dict[str, Any]:
    """Returns available roles, difficulties, and question counts."""
    metadata = {}
    for role, diffs in QUESTION_BANK.items():
        metadata[role] = {}
        for diff, types in diffs.items():
            metadata[role][diff] = {
                t: len(questions) for t, questions in types.items()
            }
    return {
        "roles": list(QUESTION_BANK.keys()),
        "difficulties": ["Easy", "Medium", "Hard"],
        "interview_types": ["Technical", "Behavioral", "Mixed"],
        "catalog": metadata
    }


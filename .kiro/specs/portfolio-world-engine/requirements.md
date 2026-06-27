# Requirements Document

## Introduction

The Portfolio World Engine is an open-source, next-generation developer portfolio delivered as an interactive 3D world. Visitors experience a developer's journey by exploring a designed environment rather than reading a conventional website. The environment itself guides exploration: a single road leads the visitor forward, a winding river separates thematic areas, and bridges represent progression. Each checkpoint in the world answers one question about the developer (Who am I? What do I know? What have I built? How do I think? What am I building next? Why should someone work with me?).

This spec defines **only the foundation** of the project: its folder structure, documentation, technical architecture, data schema contract, organization strategies, the PlayCanvas + Next.js integration strategy with pinned compatible versions, and the project-governing principles. The foundation MUST make the architecture fully reusable so that any developer can replace the portfolio data files and auto-generate their own portfolio world.

Gameplay scripting, world building, asset placement, and PlayCanvas runtime/gameplay logic are explicitly **out of scope** for this spec and will be addressed in later specs. Where a deliverable depends on something that does not yet exist in the repository, the foundation MUST provide a documented placeholder rather than a finished implementation.

The system MUST use only assets that already exist in the repository `assets/` folder. Where a needed asset does not exist, the foundation MUST record a placeholder entry instead of inventing or sourcing a new asset.

## Glossary

- **Foundation_Scaffold**: The complete set of foundation deliverables produced by this spec, including the project folder structure, documentation, configuration, and data schema. It excludes gameplay and runtime world logic.
- **Repository**: The root project directory at the workspace root that contains the `assets/` folder and the Next.js application.
- **App_Framework**: Next.js using the App Router.
- **Render_Engine**: The PlayCanvas Engine (the npm `playcanvas` package, not the hosted PlayCanvas Editor).
- **Engine_Mount**: The client-only React boundary component responsible for instantiating, owning, and disposing the Render_Engine instance inside the App_Framework.
- **Data_Schema**: The documented contract describing the structure, fields, types, and constraints of the portfolio data files.
- **Data_Files**: The JSON files that supply all portfolio content: `profile.json`, `projects.json`, `skills.json`, `experience.json`, `education.json`, `achievements.json`, `settings.json`, and `socials.json`.
- **Data_Loader**: The module responsible for reading, validating, and exposing Data_Files to the rest of the application.
- **Asset_Registry**: The documented index that maps logical asset identifiers to existing files under the `assets/` folder.
- **Asset_Library**: The existing `assets/` folder containing the asset packs: `character`, `Furniture`, `graveyard`, `nature_kit`, `prototypes`, and `small-animals`.
- **Placeholder_Entry**: A documented, explicitly-marked stand-in recorded when a required asset, value, or implementation does not yet exist.
- **Principles_Doc**: The `PROJECT_PRINCIPLES.md` document capturing the architecture principles that govern all design decisions.
- **Setup_Guide**: The developer setup guide that describes how to install dependencies and run the project locally.
- **Contributor_Guide**: The document describing how external contributors participate in the open-source project.
- **Roadmap_Doc**: The document describing future milestones and planned extensibility (data-driven generation, plugin system, multiple themes, asset indexing, AI-assisted world generation).
- **Version_Manifest**: The dependency manifest (`package.json`) plus any lockfile that pins exact dependency versions.
- **Demo_Developer**: The fictional sample developer whose data populates the Data_Files for demonstration purposes.
- **Maintainer**: A person who owns and evolves the Portfolio World Engine codebase.
- **Adopter**: A developer who reuses the engine to generate their own portfolio by replacing Data_Files.
- **Contributor**: A developer who submits changes to the open-source project.

## Requirements

### Requirement 1: Project Folder Structure

**User Story:** As a Maintainer, I want a clearly organized project folder structure, so that every part of the system has an obvious home and can be replaced independently.

#### Acceptance Criteria

1. THE Foundation_Scaffold SHALL define a top-level folder structure that separates the App_Framework application code, the Data_Files, the Render_Engine integration code, the Asset_Registry, and the documentation into distinct directories.
2. THE Foundation_Scaffold SHALL include a documented description that states the single purpose of each top-level folder.
3. THE Foundation_Scaffold SHALL preserve the existing `assets/` folder location and SHALL reference it rather than relocating or duplicating its contents.
4. WHERE a folder is created to hold a system that is implemented in a later spec, THE Foundation_Scaffold SHALL include a Placeholder_Entry that documents the folder's intended purpose.
5. THE Foundation_Scaffold SHALL organize folders so that each named system (App_Framework integration, Data_Loader, Asset_Registry, Render_Engine integration) resides in its own directory to support independent replacement.

### Requirement 2: Documentation Structure

**User Story:** As a Contributor, I want a complete documentation set, so that I can understand the project's purpose, principles, and setup without reading the source code.

#### Acceptance Criteria

1. THE Foundation_Scaffold SHALL include a `README.md` at the Repository root that summarizes the project purpose, technology stack, and links to the other documentation files.
2. THE Foundation_Scaffold SHALL include a `PROJECT_PRINCIPLES.md` that records the architecture principles defined in Requirement 9.
3. THE Foundation_Scaffold SHALL include a Setup_Guide that describes the steps to install dependencies and run the project locally.
4. THE Foundation_Scaffold SHALL include a Contributor_Guide that describes how a Contributor proposes, submits, and validates changes.
5. THE Foundation_Scaffold SHALL include a Roadmap_Doc that lists the planned future capabilities, including data-driven world generation, a plugin system, multiple portfolio themes, asset indexing, and AI-assisted world generation.
6. THE Foundation_Scaffold SHALL include documentation that describes the development milestones for delivering the engine.
7. WHERE a documentation file references a system that is not implemented in this spec, THE documentation SHALL mark that reference as a Placeholder_Entry.

### Requirement 3: Portfolio Data Schema Contract

**User Story:** As an Adopter, I want a documented data schema, so that I can replace the portfolio data and generate my own world without changing engine code.

#### Acceptance Criteria

1. THE Data_Schema SHALL define the structure, field names, data types, and required-versus-optional status for each of the Data_Files: `profile.json`, `projects.json`, `skills.json`, `experience.json`, `education.json`, `achievements.json`, `settings.json`, and `socials.json`.
2. THE Data_Schema SHALL define `profile.json` fields that answer the world checkpoint questions covering the developer's identity, knowledge, work, thinking, future direction, and reasons to collaborate.
3. THE Foundation_Scaffold SHALL provide one example instance of each Data_File populated only with Demo_Developer content.
4. THE Foundation_Scaffold SHALL ensure that all Demo_Developer content is fictional and contains no real personal data.
5. THE Data_Schema SHALL define every Data_File field independently of any specific Render_Engine, world layout, or visual asset, so that the schema describes content rather than presentation.
6. WHERE a Data_File field references a visual asset, THE Data_Schema SHALL define that reference as a logical Asset_Registry identifier rather than a direct file path.

### Requirement 4: Data-Driven Content Loading

**User Story:** As an Adopter, I want the world to read all portfolio content exclusively from the Data_Files, so that swapping the data is sufficient to produce a different portfolio.

#### Acceptance Criteria

1. THE Data_Loader SHALL read portfolio content exclusively from the Data_Files.
2. WHEN the Data_Loader reads a Data_File that conforms to the Data_Schema, THE Data_Loader SHALL expose the parsed content to the rest of the application.
3. IF a Data_File is missing a field that the Data_Schema marks as required, THEN THE Data_Loader SHALL return a descriptive validation error that names the missing field and the source file.
4. IF a Data_File contains a field whose value violates the Data_Schema type for that field, THEN THE Data_Loader SHALL fail validation and SHALL return a descriptive validation error that names the offending field and the source file.
5. THE Foundation_Scaffold SHALL ensure that no portfolio content is hardcoded in the application source code outside the Data_Files.

### Requirement 5: Asset Organization Strategy

**User Story:** As a Maintainer, I want a documented asset organization and indexing strategy, so that the world references existing assets through stable logical identifiers.

#### Acceptance Criteria

1. THE Asset_Registry SHALL map each logical asset identifier to a file, such that both the registry mapping entry exists and the mapped file already exists within the Asset_Library.
2. THE Asset_Registry SHALL reference only assets that exist in the Asset_Library packs: `character`, `Furniture`, `graveyard`, `nature_kit`, `prototypes`, and `small-animals`.
3. IF a required asset does not exist within the Asset_Library, THEN THE Foundation_Scaffold SHALL record a Placeholder_Entry that describes the needed asset instead of referencing a non-existent file.
4. THE Foundation_Scaffold SHALL document the asset organization strategy, including which model format is preferred for the Render_Engine when multiple formats exist for the same asset.
5. THE Asset_Registry SHALL define asset identifiers that are independent of file format, so that the underlying asset file can be replaced without changing identifiers used by other systems.

### Requirement 6: Scene Organization Strategy

**User Story:** As a Maintainer, I want a documented scene organization strategy, so that the world layout can be built later in a consistent, data-driven way.

#### Acceptance Criteria

1. THE Foundation_Scaffold SHALL document a scene organization strategy that defines the named world checkpoints corresponding to the six developer questions.
2. THE Foundation_Scaffold SHALL document how the scene organization derives world content from the Data_Files rather than from hardcoded scene data.
3. THE Foundation_Scaffold SHALL document the relationship between checkpoints and the guiding world elements (single road, winding river, and bridges) at a conceptual level.
4. WHERE the scene organization strategy describes runtime world construction, THE Foundation_Scaffold SHALL mark that construction as a Placeholder_Entry deferred to a later spec.

### Requirement 7: PlayCanvas and Next.js Integration Strategy

**User Story:** As a Maintainer, I want a documented, version-safe integration between the Render_Engine and the App_Framework, so that the 3D world mounts cleanly without server-side rendering conflicts.

#### Acceptance Criteria

1. THE Foundation_Scaffold SHALL document an integration strategy in which the Render_Engine is instantiated only within the Engine_Mount.
2. THE Engine_Mount SHALL execute only on the client and SHALL NOT execute Render_Engine instantiation during server-side rendering.
3. WHEN the Engine_Mount component unmounts, THE Engine_Mount SHALL dispose the Render_Engine instance and release its associated resources.
4. THE Foundation_Scaffold SHALL document the integration boundary so that App_Framework code interacts with the Render_Engine only through the Engine_Mount.
5. THE Foundation_Scaffold SHALL provide a minimal Engine_Mount that initializes a Render_Engine instance to prove the integration boundary, without implementing gameplay logic.
6. WHERE the Render_Engine requires browser-only globals, THE Foundation_Scaffold SHALL document how those globals are guarded so that a production build of the App_Framework completes without server-side reference errors.

### Requirement 8: Version Pinning and Compatibility

**User Story:** As a Maintainer, I want pinned, mutually compatible dependency versions, so that the Render_Engine, App_Framework, and React integrate without version or interdependency mismatches.

#### Acceptance Criteria

1. THE Version_Manifest SHALL pin an exact version for each of the App_Framework, React, TypeScript, TailwindCSS, and the Render_Engine.
2. THE Version_Manifest SHALL include a lockfile that records the resolved exact version of every direct and transitive dependency.
3. THE Foundation_Scaffold SHALL document the compatible version set for the App_Framework, React, and the Render_Engine, including the source used to confirm compatibility.
4. WHEN dependencies are installed from the Version_Manifest, THE installation SHALL complete without unresolved peer dependency conflicts among the App_Framework, React, and the Render_Engine.
5. WHEN a production build is run against the pinned versions, THE build SHALL NOT fail due to dependency version mismatches among the App_Framework, React, and the Render_Engine.
6. IF a documented compatible version set cannot be confirmed for the Render_Engine against the chosen App_Framework version, THEN THE Foundation_Scaffold SHALL record a Placeholder_Entry describing the unresolved compatibility risk.

### Requirement 9: Architecture Principles Governance

**User Story:** As a Maintainer, I want the project's guiding principles recorded, so that future design decisions are evaluated against a shared standard.

#### Acceptance Criteria

1. THE Principles_Doc SHALL state that story takes precedence over visuals.
2. THE Principles_Doc SHALL state that simplicity takes precedence over complexity.
3. THE Principles_Doc SHALL state that performance takes precedence over visual effects.
4. THE Principles_Doc SHALL state that all portfolio content is data-driven and that world generation depends on the Data_Files.
5. THE Principles_Doc SHALL state that assets are reusable and that the engine is open-source friendly.
6. THE Principles_Doc SHALL state that every folder has a clear purpose and that every system is independently replaceable.
7. THE Principles_Doc SHALL state that the visitor is guided by the environment and never relies on arrows or maps.

### Requirement 10: Coding Standards and Naming Conventions

**User Story:** As a Contributor, I want documented coding standards and naming conventions, so that contributions remain consistent and maintainable.

#### Acceptance Criteria

1. THE Foundation_Scaffold SHALL document coding standards covering language usage for TypeScript, file organization, and module boundaries.
2. THE Foundation_Scaffold SHALL document naming conventions for folders, files, modules, and Data_File fields.
3. THE Foundation_Scaffold SHALL configure a linter and a formatter whose rules enforce the documented coding standards.
4. WHEN the linter is run against the Foundation_Scaffold source code, THE linter SHALL report zero violations.

### Requirement 11: Developer Setup and Local Run

**User Story:** As an Adopter, I want a reliable setup process, so that I can run the project locally by following documented steps.

#### Acceptance Criteria

1. THE Setup_Guide SHALL list the required runtime tooling and exact commands to install dependencies and start the development server.
2. WHEN a developer follows the Setup_Guide steps from a clean checkout, THE App_Framework development server SHALL start without errors.
3. WHEN the App_Framework development server is running, THE Engine_Mount SHALL initialize a Render_Engine instance on the client.
4. IF a required runtime tooling version is not present, THEN THE Setup_Guide SHALL state the required version so the developer can resolve the gap.

### Requirement 12: Open-Source Reusability and Extensibility

**User Story:** As an Adopter, I want the foundation to be reusable and extensible, so that I can generate my own portfolio and the project can grow new capabilities without breaking existing systems.

#### Acceptance Criteria

1. WHEN an Adopter replaces the Data_Files with their own schema-conforming files, THE Foundation_Scaffold SHALL require no changes to the application source code to load the new content.
2. THE Foundation_Scaffold SHALL include an open-source license file at the Repository root.
3. THE Foundation_Scaffold SHALL document extension points for the future plugin system and multiple portfolio themes as conceptual boundaries.
4. WHERE an extension point is documented but not implemented in this spec, THE Foundation_Scaffold SHALL mark that extension point as a Placeholder_Entry.
5. THE Foundation_Scaffold SHALL ensure that each documented system can be replaced without modifying unrelated systems.

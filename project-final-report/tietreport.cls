%% =========================================================
%% tietreport.cls
%% TIET Software Engineering Project Report
%% MeterIQ - Mid-Semester Project Report
%% =========================================================

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{tietreport}[2026/09/16 TIET Report Class v1.2]

%% =========================================================
%% BASE REPORT CLASS
%% =========================================================

\DeclareOption*{%
    \PassOptionsToClass{\CurrentOption}{report}%
}
\ProcessOptions\relax

% openany prevents unnecessary blank pages
\LoadClass[twoside,12pt,openany]{report}

%% =========================================================
%% PAGE GEOMETRY
%% =========================================================

\RequirePackage[
    a4paper,
    inner=1.25in,
    outer=1in,
    top=1.25in,
    bottom=0.9in,
    headheight=15pt,
    headsep=0.25in
]{geometry}

%% =========================================================
%% REQUIRED PACKAGES
%% =========================================================

\RequirePackage{fancyhdr}
\RequirePackage{titlesec}
\RequirePackage{graphicx}
\RequirePackage{amsmath}
\RequirePackage{amssymb}
\RequirePackage{hyperref}

%% =========================================================
%% HEADER AND FOOTER
%% =========================================================

\pagestyle{fancy}
\fancyhf{}

\fancyhead[LE]{%
    \thepage\quad\@tpHeader
}

\fancyhead[RO]{%
    \@tpTitle\quad\thepage
}

\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\footrulewidth}{0pt}

%% =========================================================
%% CHAPTER FORMAT
%% =========================================================

\titleformat{\chapter}[display]
    {\raggedleft\bfseries\large}
    {Chapter \thechapter}
    {0.3em}
    {\huge}
    [\vspace{0.1em}\hrule]

\titlespacing*{\chapter}
    {0pt}
    {-20pt}
    {25pt}

\assignpagestyle{\chapter}{empty}

%% =========================================================
%% INTERNAL TITLE VARIABLES
%% =========================================================

\newcommand{\@tpHeader}{%
    UCS503 - Software Engineering
}

\newcommand{\@tpTitle}{%
    MeterIQ
}

\newcommand{\@tpSubTitle}{%
    Explainable Smart Meter Analytics Platform
}

\newcommand{\@tpAuthors}{%
    \texttt{1024160006} Yashit Arora\\
    \texttt{1024160008} Aarushi Gahlawat
}

\newcommand{\@tpSubText}{%
    Group: \texttt{3P11} \quad BE Third Year, CSE
}

\newcommand{\@tpAdvisor}{%
    Mr. Jeelani
}

\newcommand{\@tpFooter}{%
    \large Mid-Semester Evaluation\\[0.2cm]
    \bfseries Computer Science and Engineering\\
    Department\\[0.15cm]
    Thapar Institute of Engineering and Technology, Patiala
}

%% =========================================================
%% PUBLIC CONFIGURATION COMMANDS
%% =========================================================

\newcommand{\TitlePageHeader}[1]{%
    \renewcommand{\@tpHeader}{#1}%
}

\newcommand{\ProjectTitle}[1]{%
    \renewcommand{\@tpTitle}{#1}%
}

\newcommand{\ProjectSubTitle}[1]{%
    \renewcommand{\@tpSubTitle}{#1}%
}

\renewcommand{\author}[1]{%
    \renewcommand{\@tpAuthors}{#1}%
}

\newcommand{\TitlePageSubText}[1]{%
    \renewcommand{\@tpSubText}{#1}%
}

\newcommand{\AdvisorName}[1]{%
    \renewcommand{\@tpAdvisor}{#1}%
}

\newcommand{\TitlePageFooterText}[1]{%
    \renewcommand{\@tpFooter}{#1}%
}

%% =========================================================
%% CUSTOM TITLE PAGE
%% =========================================================

\renewcommand{\maketitle}{%
    \begin{titlepage}
        \thispagestyle{empty}
        \centering

        \vspace*{0.6cm}

        {\large\textbf{\@tpHeader}}

        \vspace{2.2cm}

        {\LARGE\textbf{\@tpTitle}}

        \vspace{0.3cm}

        {\large\@tpSubTitle}

        \vspace{3cm}

        {\large\textbf{Submitted by:}}

        \vspace{0.25cm}

        {\large\@tpAuthors}

        \vspace{0.6cm}

        {\normalsize\@tpSubText}

        \vfill

        {\large\textbf{Submitted to:}}

        \vspace{0.25cm}

        {\normalsize\@tpAdvisor}

        \vspace{1.5cm}

        {\normalsize\@tpFooter}

    \end{titlepage}
}

\endinput